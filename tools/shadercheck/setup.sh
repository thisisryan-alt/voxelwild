#!/usr/bin/env bash
# Fetches what check_shaders.py needs into tools/shadercheck/.cache (git-ignored):
#   - a sparse, shallow checkout of Unity-Technologies/Graphics on the branch matching the editor
#     (only the core / universal shader libraries and the generated .cs.hlsl files)
#   - a Linux build of Microsoft's DXC
# Then: python3 tools/shadercheck/check_shaders.py --graphics tools/shadercheck/.cache/graphics \
#                                                    --dxc tools/shadercheck/.cache/dxc/bin/dxc
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cache="$here/.cache"
branch="${GRAPHICS_BRANCH:-6000.4/staging}"                 # URP 17.4 = Unity 6000.4
dxc_url="${DXC_URL:-https://github.com/microsoft/DirectXShaderCompiler/releases/download/v1.8.2502/linux_dxc_2025_02_20.x86_64.tar.gz}"
mkdir -p "$cache"

if [ ! -d "$cache/graphics/.git" ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --branch "$branch" --filter=blob:none --sparse \
    https://github.com/Unity-Technologies/Graphics "$cache/graphics"
fi
GIT_LFS_SKIP_SMUDGE=1 git -C "$cache/graphics" sparse-checkout set \
  Packages/com.unity.render-pipelines.core/ShaderLibrary \
  Packages/com.unity.render-pipelines.core/Runtime \
  Packages/com.unity.render-pipelines.universal/ShaderLibrary \
  Packages/com.unity.render-pipelines.universal/Runtime \
  Packages/com.unity.render-pipelines.universal-config/Runtime

if [ ! -x "$cache/dxc/bin/dxc" ]; then
  mkdir -p "$cache/dxc"
  curl -sSL "$dxc_url" | tar xz -C "$cache/dxc"
fi
"$cache/dxc/bin/dxc" --version || LD_LIBRARY_PATH="$cache/dxc/lib" "$cache/dxc/bin/dxc" --version
