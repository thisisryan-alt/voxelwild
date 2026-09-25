#!/usr/bin/env python3
"""
Compile every pass of the project's ShaderLab shaders outside Unity, against the real URP / Core RP shader
libraries, with glslang's HLSL front end (HLSL -> SPIR-V, as for Vulkan). Catches syntax errors, undeclared
identifiers, type mismatches and missing includes before the editor ever sees the shader.

Usage:
  python3 tools/shadercheck/check_shaders.py --graphics <path to Unity-Technologies/Graphics checkout>
        [--dxc path/to/dxc] [--shader Assets/Shaders/Water/VoxelWater.shader] [--all-variants] [-v]

DXC: a Linux release from github.com/microsoft/DirectXShaderCompiler/releases (bin/dxc + lib/); `dxc` on
PATH is used when --dxc is not given.

The Graphics checkout must be on the branch matching the editor (6000.4/staging for URP 17.4); only
Packages/com.unity.render-pipelines.{core,universal}/ShaderLibrary are needed (a sparse checkout is enough).

Variants: by default every keyword set is exercised one option at a time with the others off, plus one
"everything on" variant (last option of each set). --all-variants compiles the full cartesian product
(slow). Not modelled: Unity's own shader-compiler defines beyond the ones below, and the Metal / D3D back ends.
"""
import argparse
import itertools
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GRAPHICS = None

# What Unity defines for a compile of a Unity 6.4 shader at target 4.5 (plus the API define per back end)
API_DEFINES = {"vulkan": "SHADER_API_VULKAN", "d3d": "SHADER_API_D3D11"}
BASE_DEFINES = {
    "UNITY_VERSION": "60004",
    "SHADER_TARGET": "45",
    "UNITY_ENABLE_CBUFFER": "1",
    "UNITY_NO_DXT5nm": "1",
}

PROGRAM_RE = re.compile(r"HLSLPROGRAM(.*?)ENDHLSL", re.S)
INCLUDE_BLOCK_RE = re.compile(r"HLSLINCLUDE(.*?)ENDHLSL", re.S)
PRAGMA_RE = re.compile(r"^\s*#pragma\s+(\w+)\s*(.*?)\s*$", re.M)


def strip_comments(text):
    text = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def find_passes(shader_text, rel):
    """Yields (pass label, include blocks, program body) for each HLSLPROGRAM, with the HLSLINCLUDE
    blocks that precede it in the same SubShader. Each block starts with a #line pointing into the
    .shader file, so errors name the real line."""
    text = strip_comments(shader_text)
    passes = []
    offset = 0
    for sub in re.split(r"(?=\bSubShader\b)", text):
        base = text.count("\n", 0, offset)
        offset += len(sub)
        if not sub.lstrip().startswith("SubShader"):
            continue

        def block(m):
            line = base + sub.count("\n", 0, m.start(1)) + 1
            return f'#line {line} "{rel}"\n' + m.group(1)

        includes = [block(m) for m in INCLUDE_BLOCK_RE.finditer(sub)]
        for i, m in enumerate(PROGRAM_RE.finditer(sub)):
            head = sub[: m.start()]
            names = re.findall(r'Name\s+"([^"]+)"', head)
            label = names[-1] if names else f"pass{i}"
            passes.append((label, includes, block(m)))
    return passes


def resolve_include(path, graphics):
    if path.startswith("Packages/"):
        return os.path.join(graphics, path)
    return os.path.join(ROOT, path)


def collect_pragmas(code, graphics, seen=None):
    """Pragmas in the code and in files pulled in with #include_with_pragmas (recursively)."""
    seen = seen if seen is not None else set()
    pragmas = []
    for m in PRAGMA_RE.finditer(code):
        pragmas.append((m.group(1), m.group(2)))
    for inc in re.findall(r'#include_with_pragmas\s+"([^"]+)"', code):
        p = resolve_include(inc, graphics)
        if p in seen or not os.path.exists(p):
            continue
        seen.add(p)
        with open(p, encoding="utf-8", errors="replace") as f:
            pragmas += collect_pragmas(strip_comments(f.read()), graphics, seen)
    return pragmas


def keyword_sets(pragmas):
    """[(stage or None, [options])] for multi_compile / shader_feature pragmas."""
    sets = []
    for name, args in pragmas:
        if name.startswith("multi_compile") or name.startswith("shader_feature") or name.startswith("dynamic_branch"):
            if name in ("multi_compile_instancing",):
                sets.append((None, ["_", "INSTANCING_ON"]))
                continue
            if name in ("multi_compile_fog",):
                sets.append((None, ["_", "FOG_LINEAR", "FOG_EXP", "FOG_EXP2"]))
                continue
            opts = args.split()
            if not opts:
                continue
            if name.startswith("shader_feature") and len(opts) == 1:
                opts = ["_"] + opts
            stage = "vertex" if name.endswith("_vertex") else "fragment" if name.endswith("_fragment") else None
            sets.append((stage, opts))
    return sets


def variants(sets, all_variants):
    if not sets:
        return [()]
    if all_variants:
        return [tuple(k for k in combo if k not in ("_", "__")) for combo in itertools.product(*[s[1] for s in sets])]
    out = [()]
    for _, opts in sets:
        for o in opts[1:]:
            if o not in ("_", "__"):
                out.append((o,))
    out.append(tuple(opts[-1] for _, opts in sets if opts[-1] not in ("_", "__")))
    uniq = []
    for v in out:
        if v not in uniq:
            uniq.append(v)
    return uniq


def compile_stage(dxc, backend, source, entry, stage, defines, verbose, warnings=None):
    with tempfile.NamedTemporaryFile("w", suffix=".hlsl", delete=False) as f:
        f.write(source)
        path = f.name
    cmd = [dxc, "-T", ("vs" if stage == "vertex" else "ps") + "_6_0", "-E", entry,
           "-HV", "2018",                 # the language level Unity's shader compiler accepts
           "-Wno-ignored-attributes",
           "-I", GRAPHICS, "-I", ROOT, "-Fo", os.devnull]
    if backend == "vulkan":
        cmd += ["-spirv", "-fspv-target-env=vulkan1.1"]
    for k, v in defines.items():
        cmd += ["-D", f"{k}={v}"]
    cmd.append(path)
    env = dict(os.environ)
    lib = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(dxc))), "lib")
    if os.path.isdir(lib):
        env["LD_LIBRARY_PATH"] = lib + os.pathsep + env.get("LD_LIBRARY_PATH", "")
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    text = (r.stdout + r.stderr).replace(path, "<pass>")
    if not verbose:
        os.unlink(path)
    if warnings is not None:
        # warnings in the project's own code (the render pipeline libraries have their own)
        for line in text.splitlines():
            if "warning:" in line and (line.startswith("Assets/") or line.startswith(os.path.join(ROOT, "Assets"))):
                warnings.add(line.replace(ROOT + os.sep, ""))
    return r.returncode == 0, text


def prepare(includes, body):
    code = "\n".join(includes) + "\n" + body
    code = code.replace("#include_with_pragmas", "#include")
    # Unity-only pragmas mean nothing to glslang
    return re.sub(r"^\s*#pragma[^\n]*", "", code, flags=re.M)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--graphics", required=True)
    ap.add_argument("--dxc", default="dxc")
    ap.add_argument("--backend", choices=["vulkan", "d3d", "both"], default="both",
                    help="vulkan: SPIR-V; d3d: DXIL through DXC's validator (Direct3D 12 rules)")
    ap.add_argument("--shader", action="append")
    ap.add_argument("--all-variants", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    global GRAPHICS
    GRAPHICS = os.path.abspath(args.graphics)

    shaders = args.shader or sorted(
        os.path.relpath(os.path.join(d, f), ROOT)
        for d, _, fs in os.walk(os.path.join(ROOT, "Assets", "Shaders")) for f in fs if f.endswith(".shader"))
    failures = 0
    compiled = 0
    warnings = set()
    for rel in shaders:
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            text = f.read()
        for label, includes, body in find_passes(text, rel):
            pragmas = collect_pragmas("\n".join(includes) + "\n" + body, args.graphics)
            entries = {n: a.split()[0] for n, a in pragmas if n in ("vertex", "fragment")}
            sets = keyword_sets(pragmas)
            source = prepare(includes, body)
            backends = ["vulkan", "d3d"] if args.backend == "both" else [args.backend]
            for backend, variant, stage in itertools.product(backends, variants(sets, args.all_variants), ("vertex", "fragment")):
                    if stage not in entries:
                        continue
                    defines = dict(BASE_DEFINES)
                    defines[API_DEFINES[backend]] = "1"
                    defines["SHADER_STAGE_VERTEX" if stage == "vertex" else "SHADER_STAGE_FRAGMENT"] = "1"
                    for k in variant:
                        defines[k] = "1"
                    if "INSTANCING_ON" in variant:
                        # UnityInstancing.hlsl pastes `arr##Array` onto a macro argument; Unity's preprocessor
                        # expands the argument first, a standard one (DXC's) doesn't. Even a bare URP program
                        # fails without this.
                        defines["UNITY_BUILTINS_WITH_WORLDTOOBJECTARRAYArray"] = "unity_Builtins0Array"
                    ok, log = compile_stage(args.dxc, backend, source, entries[stage], stage, defines, args.verbose, warnings)
                    compiled += 1
                    if not ok:
                        failures += 1
                        print(f"FAIL {rel} [{label}] {backend} {stage} {' '.join(variant) or '(no keywords)'}")
                        lines = [l for l in log.splitlines() if "error:" in l][:12]
                        print("   " + "\n   ".join(lines or log.splitlines()[:12]))
                    elif args.verbose:
                        print(f"ok   {rel} [{label}] {backend} {stage} {' '.join(variant)}")
    for w in sorted(warnings):
        print("warn " + w)
    print(f"{compiled} stage compiles, {failures} failed, {len(warnings)} distinct warnings in project code")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
