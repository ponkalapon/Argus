#!/usr/bin/env node

/**
 * Argus CLI - Universal Updater & Launcher
 *
 * Usage:
 *   node argus-cli.js update    # Pull latest code, install deps, rebuild
 *   node argus-cli.js start     # Launch the app (desktop only)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Detect platform
const platform = process.platform === 'android' ? 'mobile' : 'desktop';
const isDesktop = platform === 'desktop';
const isMobile = platform === 'mobile';

console.log(`[Argus CLI] Running in ${platform} mode (${process.platform})`);

// --- Core Functions ---

function update() {
    console.log("[Update] Fetching latest changes from GitHub...");
    execSync('git pull origin master', { stdio: 'inherit' });
    
    console.log("[Update] Installing dependencies...");
    execSync('npm install', { stdio: 'inherit' });
    
    if (isDesktop) {
        console.log("[Update] Building desktop app...");
        execSync('npm run build', { stdio: 'inherit' });
    } else {
        console.log("[Update] Mobile environment ready.");
    }
    
    console.log("[Update] Done!");
}

function start() {
    if (!isDesktop) {
        console.error("[Error] 'start' command is only available for desktop.");
        process.exit(1);
    }
    
    console.log("[Start] Launching Argus Desktop...");
    execSync('npm start', { stdio: 'inherit' });
}

// --- Bootstrap Helpers ---

function createBootstrapScripts() {
    const bootstrapDir = path.join(__dirname, 'releases', 'bootstrap');
    if (!fs.existsSync(bootstrapDir)) {
        fs.mkdirSync(bootstrapDir, { recursive: true });
    }
    
    // Windows (PC)
    fs.writeFileSync(path.join(bootstrapDir, 'PC_Bootstrap.bat'), `
@echo off

echo [Argus Bootstrap] Cloning repository...
git clone https://github.com/ponkalapon/Argus.git Argus
cd Argus

node argus-cli.js update

pause
`);
    
    // Linux/macOS (PC)
    fs.writeFileSync(path.join(bootstrapDir, 'Linux_Bootstrap.sh'), `#!/bin/bash

echo "[Argus Bootstrap] Cloning repository..."
git clone https://github.com/ponkalapon/Argus.git Argus
cd Argus

node argus-cli.js update
`);
    
    // Android (Termux)
    fs.writeFileSync(path.join(bootstrapDir, 'Android_Bootstrap.sh'), `#!/bin/bash

pkg install git nodejs -y
echo "[Argus Bootstrap] Cloning repository..."
git clone https://github.com/ponkalapon/Argus.git Argus
cd Argus

node argus-cli.js update
`);
    
    console.log("[Bootstrap] Created bootstrap scripts in /releases/bootstrap/");
}

// --- CLI Dispatch ---

const command = process.argv[2];

switch (command) {
    case 'update':
        update();
        break;
    case 'start':
        start();
        break;
    case 'bootstrap':
        createBootstrapScripts();
        break;
    default:
        console.log("Argus CLI - Universal Updater & Launcher\n");
        console.log("Usage:");
        console.log("  node argus-cli.js update     # Pull latest code, install deps, rebuild");
        console.log("  node argus-cli.js start      # Launch the app (desktop only)");
        console.log("  node argus-cli.js bootstrap  # Generate bootstrap scripts for all platforms");
}