#!/usr/bin/env bash
# Type-check the Unity C# outside Unity. Fails on any compiler error not listed in known-errors.txt.
#   tools/cscheck/run.sh [path/to/Unity.Mathematics/Unity.Mathematics]
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
args=()
[ $# -ge 1 ] && args+=("-p:MathematicsSrc=$1")
out="$(dotnet build "$here/Voxelwild.TypeCheck.csproj" -nologo -v q "${args[@]}" 2>&1)"
errors="$(printf '%s\n' "$out" | grep -E ': error [A-Z]+[0-9]+' | sed -E 's/ \[[^]]*\]$//' | sort -u)"
unexpected="$(printf '%s\n' "$errors" | grep -v -f <(grep -v '^#' "$here/known-errors.txt" | sed '/^$/d') | sed '/^$/d')"
known=$(printf '%s\n' "$errors" | sed '/^$/d' | wc -l)
if [ -n "$unexpected" ]; then
  printf '%s\n' "$unexpected"
  echo "type check: $(printf '%s\n' "$unexpected" | wc -l) unexpected error(s)"
  exit 1
fi
if ! printf '%s\n' "$out" | grep -qE 'Build succeeded|error'; then printf '%s\n' "$out" | tail -20; exit 1; fi
echo "type check: clean (${known} known Unity 6-only API errors ignored)"
