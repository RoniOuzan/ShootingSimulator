@echo off
title Shooting Simulator

echo =========================================
echo   Booting up Shooting Simulator...
echo =========================================
echo.

:: CLEANUP: Kill any ghost Java servers holding the port hostage
echo Cleaning up old processes...
taskkill /F /IM java.exe >nul 2>&1

:: Navigate into the React frontend folder first
cd shootingsimulator-frontend

:: Check if node_modules exists, if not, run npm install automatically
if not exist "node_modules\" (
    echo [Setup] First time running on this PC. Installing dependencies...
    call npm install
)

:: Launch the development servers
call npm run dev

:: If the servers crash, this keeps the window open so you can read the error
pause