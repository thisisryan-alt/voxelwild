"""Offline compile check for the project's URP shaders, without the Unity editor.

Every Pass of every .shader is expanded the way Unity's compiler sees it (SubShader HLSLINCLUDE blocks +
the pass program, `#include_with_pragmas` resolved, keyword variants defined), then the vertex and
fragment entry points are compiled with Slang (an HLSL-compatible front end; `pip install slangpy`)
against the real URP / Core RP 17.4 shader libraries. It catches syntax errors, undefined identifiers,
type and signature mismatches - not Unity-specific issues such as SRP-batcher layout or platform limits.

    python tools/check_shaders.py                       # all shaders under Assets/Shaders
    python tools/check_shaders.py Assets/Shaders/Character/CharacterSkin.shader
    python tools/check_shaders.py --graphics <path to Unity Graphics checkout>

The URP / Core shader libraries come from Unity's public Graphics repository (branch 6000.4/staging =
URP 17.4.0, matching Packages/manifest.json); a sparse checkout is cached in tools/.cache (git-ignored).
"""
from __future__ import annotations

import argparse
import itertools
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE = os.path.join(ROOT, "tools", ".cache")
GRAPHICS_BRANCH = "6000.4/staging"


def ensure_graphics(path: str | None) -> str:
    if path:
        return path
    g = os.path.join(CACHE, "Graphics")
    if not os.path.exists(os.path.join(g, "Packages", "com.unity.render-pipelines.universal", "ShaderLibrary")):
        os.makedirs(CACHE, exist_ok=True)
        subprocess.check_call(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", "-b",
                               GRAPHICS_BRANCH, "https://github.com/Unity-Technologies/Graphics", g])
        subprocess.check_call(["git", "-C", g, "sparse-checkout", "set", "--no-cone",
                               "/Packages/com.unity.render-pipelines.universal/**/*.hlsl",
                               "/Packages/com.unity.render-pipelines.core/**/*.hlsl",
                               "/Packages/com.unity.render-pipelines.universal-config/**/*.hlsl",
                               "/Packages/com.unity.render-pipelines.core/ShaderLibrary/**",
                               "/Packages/com.unity.render-pipelines.universal/ShaderLibrary/**"])
    return g


def blocks(text, start, end):
    out, i = [], 0
    while True:
        a = text.find(start, i)
        if a < 0:
            return out
        b = text.find(end, a)
        out.append((a, text[a + len(start):b]))
        i = b + len(end)


def passes(shader_text):
    """[(pass_name, include_src, program_src)] in file order."""
    incs = blocks(shader_text, "HLSLINCLUDE", "ENDHLSL")
    progs = blocks(shader_text, "HLSLPROGRAM", "ENDHLSL")
    out = []
    for pos, src in progs:
        include = "\n".join(s for p, s in incs if p < pos)
        head = shader_text[:pos]
        m = list(re.finditer(r'Name\s+"([^"]+)"', head))
        out.append((m[-1].group(1) if m else f"pass@{pos}", include, src))
    return out


def keyword_sets(src):
    """Representative variants: everything off, everything on (last option), and each middle option."""
    lines = re.findall(r"#pragma\s+(multi_compile\w*|shader_feature\w*)\s+(.+)", src)
    groups = []
    for kind, opts in lines:
        o = opts.split()
        if kind.startswith("shader_feature") and len(o) == 1:
            o = ["_"] + o
        groups.append([x for x in o])
    sets = [[g[0] for g in groups], [g[-1] for g in groups]]
    for gi, g in enumerate(groups):
        for opt in g[1:-1]:
            s = [x[-1] for x in groups]
            s[gi] = opt
            sets.append(s)
    uniq = []
    for s in sets:
        k = tuple(sorted(x for x in s if x != "_" and not x.startswith("__")))
        if k not in uniq:
            uniq.append(k)
    return uniq


def entry_names(src):
    v = re.search(r"#pragma\s+vertex\s+(\w+)", src)
    f = re.search(r"#pragma\s+fragment\s+(\w+)", src)
    return (v.group(1) if v else None), (f.group(1) if f else None)


# Slang has no min16 types; D3D's minimum-precision types are half/int/uint with relaxed precision
PRELUDE = "\n".join(
    [f"typedef half{n} min16float{n};" for n in ("", "2", "3", "4")]
    + [f"typedef matrix<half, {r}, {c}> min16float{r}x{c};" for r in (2, 3, 4) for c in (2, 3, 4)]
    + [f"typedef {t}{n} min16{t}{n};" for t in ("int", "uint") for n in ("", "2", "3", "4")]) + "\n"


def expand(include, program):
    body = PRELUDE + include + "\n" + program
    body = re.sub(r"#include_with_pragmas", "#include", body)
    body = re.sub(r"^\s*#pragma\s+(vertex|fragment|target|multi_compile\w*|shader_feature\w*|require).*$", "",
                  body, flags=re.M)
    return body


def compile_variant(spy, sess_cache, graphics, body, keywords, entry, stage):
    defines = {"SHADER_API_D3D11": "1", "UNITY_COMPILER_DXC": "1", "SHADER_TARGET": "45",
               "UNITY_VERSION": "60004011", "UNITY_REVERSED_Z": "1",
               f"SHADER_STAGE_{stage.upper()}": "1"}
    for k in keywords:
        defines[k] = "1"
    key = tuple(sorted(defines.items()))
    sess = sess_cache.get(key)
    if sess is None:
        opts = spy.SlangCompilerOptions({"include_paths": [graphics, ROOT], "defines": defines,
                                         "disable_warnings": ["15205", "15400", "30081", "30056", "39001"]})
        sess = sess_cache.setdefault(key, sess_cache["__dev"].create_slang_session(compiler_options=opts))
    name = f"m{abs(hash((body, key, entry))) % 10**12}"
    mod = sess.load_module_from_source(name, body)
    ep = mod.entry_point(entry)
    sess.link_program([mod], [ep])


def project_errors(log, graphics):
    """Errors whose location is in project code (the expanded pass or Assets/ includes). Errors inside the
    URP/Core library are Slang-vs-DXC dialect differences in code Unity compiles fine, so they're ignored."""
    out, cur = [], None
    for line in log.splitlines():
        m = re.match(r"\s*(?:fatal )?error\[(E\d+)\]: (.*)", line)
        if m:
            cur = [m.group(1), m.group(2), None]
            continue
        m = re.match(r"\s*-->\s*(.+?):(\d+):(\d+)", line)
        if m and cur is not None and cur[2] is None:
            cur[2] = (m.group(1), int(m.group(2)))
            path = m.group(1)
            in_lib = os.path.abspath(path).startswith(os.path.abspath(graphics)) or "/.cache/Graphics/" in path
            if not in_lib and cur[0] not in ("E39999", "E40003"):
                where = os.path.relpath(path, ROOT) if os.path.isabs(path) else f"<pass source>:{m.group(2)}"
                out.append(f"{where}:{m.group(2)} {cur[0]} {cur[1]}" if os.path.isabs(path) else f"{where} {cur[0]} {cur[1]}")
            cur = None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--graphics", default=None)
    args = ap.parse_args()
    try:
        import slangpy as spy
    except ImportError:
        sys.exit("pip install slangpy")
    graphics = ensure_graphics(args.graphics)
    files = args.files or [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(ROOT, "Assets", "Shaders"))
                           for f in fs if f.endswith(".shader")]
    cache = {"__dev": spy.Device(type=spy.DeviceType.cpu)}
    failures = total = lib_only = 0
    for f in sorted(files):
        text = open(f, encoding="utf-8").read()
        rel = os.path.relpath(f, ROOT)
        for pname, inc, prog in passes(text):
            vs, fs = entry_names(prog)
            body = expand(inc, prog)
            for kws in keyword_sets(inc + "\n" + prog):
                for entry, stage in ((vs, "vertex"), (fs, "fragment")):
                    if not entry:
                        continue
                    total += 1
                    try:
                        compile_variant(spy, cache, graphics, body, kws, entry, stage)
                    except Exception as e:  # noqa: BLE001
                        own = project_errors(str(e), graphics)
                        if own:
                            failures += 1
                            print(f"FAIL {rel} [{pname}] {stage} {entry} {' '.join(kws) or '(no keywords)'}")
                            for err in own[:12]:
                                print("   ", err)
                            print()
                        else:
                            lib_only += 1
        print(f"checked {rel}")
    print(f"{total - failures}/{total} entry-point variants without errors in project code "
          f"({lib_only} hit only Slang/URP-library incompatibilities, ignored)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
