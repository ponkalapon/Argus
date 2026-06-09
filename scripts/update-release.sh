#!/bin/bash

read -r TOKEN < /c/Users/dimap/AppData/Local/Temp/gh_token.txt

echo "Updating release body..."
curl -s -X PATCH \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/ponkalapon/Argus/releases/336441857 \
  -d @/h/argus/release.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Updated: {d.get(\"name\")}')" 2>/dev/null || curl -s -X PATCH \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/ponkalapon/Argus/releases/336441857 \
  -d @/h/argus/release.json | grep '"body"' | head -c 80
