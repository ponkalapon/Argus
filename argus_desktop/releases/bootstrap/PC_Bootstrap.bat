@echo off
REM Argus Desktop Bootstrap - Windows
REM This script initializes Argus on Windows PC

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo  Argus AI - Desktop Bootstrap v1.0.0
echo ===============================================
echo.

REM Check if Git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed. Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/3] Cloning Argus repository...
git clone https://github.com/ponkalapon/Argus.git Argus
if %errorlevel% neq 0 (
    echo [ERROR] Failed to clone repository.
    pause
    exit /b 1
)

cd Argus
echo [2/3] Installing dependencies...

REM Run the CLI update command
node argus-cli.js update
if %errorlevel% neq 0 (
    echo [ERROR] Update failed.
    pause
    exit /b 1
)

echo.
echo ===============================================
echo  [SUCCESS] Argus is ready!
echo ===============================================
echo.
echo To start Argus, run:
echo   cd Argus
echo   node argus-cli.js start
echo.
pause
