const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PATCHES = path.join(ROOT, 'patches');

// Patch @react-native-voice/voice build.gradle (jcenter removal, compileSdk fix, namespace)
const VOICE_GRADLE = path.join(ROOT, 'node_modules', '@react-native-voice', 'voice', 'android', 'build.gradle');
const VOICE_MANIFEST = path.join(ROOT, 'node_modules', '@react-native-voice', 'voice', 'android', 'src', 'main', 'AndroidManifest.xml');
const PATCH_GRADLE = path.join(PATCHES, 'voice-build.gradle.fixed');
const PATCH_MANIFEST = path.join(PATCHES, 'voice-AndroidManifest.xml.fixed');

if (fs.existsSync(PATCH_GRADLE) && fs.existsSync(VOICE_GRADLE)) {
  fs.copyFileSync(PATCH_GRADLE, VOICE_GRADLE);
  console.log('[postinstall] Patched @react-native-voice/voice/build.gradle');
}
if (fs.existsSync(PATCH_MANIFEST) && fs.existsSync(VOICE_MANIFEST)) {
  fs.copyFileSync(PATCH_MANIFEST, VOICE_MANIFEST);
  console.log('[postinstall] Patched @react-native-voice/voice/AndroidManifest.xml');
}

// Disable New Architecture in generated android/gradle.properties
const GRADLE_PROPS = path.join(ROOT, 'apps', 'argus-mobile', 'android', 'gradle.properties');
if (fs.existsSync(GRADLE_PROPS)) {
  const content = fs.readFileSync(GRADLE_PROPS, 'utf8');
  const updated = content.replace(/^newArchEnabled=true$/m, 'newArchEnabled=false');
  if (content !== updated) {
    fs.writeFileSync(GRADLE_PROPS, updated, 'utf8');
    console.log('[postinstall] Set newArchEnabled=false in gradle.properties');
  }
}

console.log('[postinstall] Done.');
