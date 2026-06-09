#!/bin/bash

# Argus Mobile Bootstrap - Android (Termux)
# This script initializes Argus on Android via Termux

echo ""
echo "==============================================="
echo "  Argus AI - Mobile Bootstrap v1.0.0 (Android)"
echo "==============================================="
echo ""

echo "[0/4] Updating package manager..."
apt update && apt upgrade -y

echo "[1/4] Installing Git..."
apt install git -y
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install Git."
    exit 1
fi

echo "[2/4] Installing Node.js..."
apt install nodejs -y
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install Node.js."
    exit 1
fi

echo "[3/4] Cloning Argus repository..."
git clone https://github.com/ponkalapon/Argus.git Argus
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to clone repository."
    exit 1
fi

cd Argus
echo "[4/4] Installing dependencies and building..."

# Run the CLI update command
node argus-cli.js update
if [ $? -ne 0 ]; then
    echo "[ERROR] Update failed."
    exit 1
fi

echo ""
echo "==============================================="
echo "  [SUCCESS] Argus Mobile is ready!"
echo "==============================================="
echo ""
echo "Next steps:"
echo "  1. Install Expo Go app from Play Store"
echo "  2. Run: npm start"
echo "  3. Scan QR code with your device"
echo ""
echo "To update in the future, run:"
echo "  node argus-cli.js update"
echo ""