#!/bin/bash

read -r TOKEN < /c/Users/dimap/AppData/Local/Temp/gh_token.txt
echo "Got token: ${#TOKEN} chars"

echo "=== Delete tag ==="
curl -s -X DELETE \
  -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/ponkalapon/Argus/git/refs/tags/v1.0.0-build1"
echo ""

echo "=== Create release ==="
curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/ponkalapon/Argus/releases \
  -d @/h/argus/release.json
echo ""
