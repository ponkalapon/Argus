const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const PATCHES = path.join(ROOT, 'patches');

const FILES_TO_PATCH = [
  {
    src: path.join(PATCHES, 'voice-build.gradle.fixed'),
    dst: path.join(ROOT, 'node_modules', '@react-native-voice', 'voice', 'android', 'build.gradle'),
  },
  {
    src: path.join(PATCHES, 'voice-AndroidManifest.xml.fixed'),
    dst: path.join(ROOT, 'node_modules', '@react-native-voice', 'voice', 'android', 'src', 'main', 'AndroidManifest.xml'),
  },
];

function patchFile(src, dst) {
  if (!fs.existsSync(src)) {
    console.log(`[postinstall] Patch source not found: ${src}`);
    return;
  }
  const dir = path.dirname(dst);
  if (!fs.existsSync(dir)) {
    console.log(`[postinstall] Target directory doesn't exist: ${dir}`);
    return;
  }
  fs.copyFileSync(src, dst);
  console.log(`[postinstall] Patched: ${path.relative(ROOT, dst)}`);
}

function main() {
  console.log('[postinstall] Applying patches...');
  for (const f of FILES_TO_PATCH) {
    patchFile(f.src, f.dst);
  }
  console.log('[postinstall] Done.');
}

main();
