#!/bin/bash

read -r TOKEN < /c/Users/dimap/AppData/Local/Temp/gh_token.txt
RELEASE_ID=336441857
APK_PATH="/h/argus/apps/argus-mobile/argus-mobile-v1.0.0.apk"

echo "Got token: ${#TOKEN} chars"
echo "Uploading APK ($(ls -lh $APK_PATH | awk '{print $5}'))..."

curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/vnd.android.package-archive" \
  "https://uploads.github.com/repos/ponkalapon/Argus/releases/$RELEASE_ID/assets?name=argus-mobile-v1.0.0.apk" \
  --data-binary @$APK_PATH
echo ""
