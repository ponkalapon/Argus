#!/bin/bash

# Argus Desktop Bootstrap - Linux/macOS
# This script initializes Argus on Linux or macOS

echo ""
echo "==============================================="
echo "  Argus AI - Desktop Bootstrap v1.0.0"
echo "==============================================="
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git is not installed. Please install Git:"
    echo "  Linux: sudo apt install git (Debian/Ubuntu)"
    echo "  macOS: brew install git"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js:"
    echo "  Linux: sudo apt install nodejs npm (Debian/Ubuntu)"
    echo "  macOS: brew install node"
    exit 1
fi

echo "[1/3] Cloning Argus repository..."
git clone https://github.com/ponkalapon/Argus.git Argus
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to clone repository."
    exit 1
fi

cd Argus
echo "[2/3] Installing dependencies..."

# Run the CLI update command
node argus-cli.js update
if [ $? -ne 0 ]; then
    echo "[ERROR] Update failed."
    exit 1
fi

echo ""
echo "==============================================="
echo "  [SUCCESS] Argus is ready!"
echo "==============================================="
echo ""
echo "To start Argus, run:"
echo "  cd Argus"
echo "  node argus-cli.js start"
echo ""