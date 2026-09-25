#!/usr/bin/env bash
# Downloads the com.unity.mathematics version pinned in Packages/packages-lock.json from Unity's package
# registry and unpacks it into $1 (sources end up in $1/package/Unity.Mathematics).
set -euo pipefail
dest="$1"
root="$(cd "$(dirname "$0")/../.." && pwd)"
version="$(python3 -c "import json; print(json.load(open('$root/Packages/packages-lock.json'))['dependencies']['com.unity.mathematics']['version'])")"
mkdir -p "$dest"
curl -sSL "https://download.packages.unity.com/com.unity.mathematics/-/com.unity.mathematics-$version.tgz" | tar xz -C "$dest"
echo "Unity.Mathematics $version -> $dest/package/Unity.Mathematics"
