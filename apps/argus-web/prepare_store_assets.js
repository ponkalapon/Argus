const fs = require('fs');
const path = require('path');

// Simple PNG maker or copy helper using sharp/jimp or raw stream resize if available
// Let's create an html canvas converter script via Electron or sharp if present in node_modules

const iconPath = path.join(__dirname, 'assets', 'icon.png');
const outDir = path.join(__dirname, 'store_assets');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Icon path:', iconPath);
