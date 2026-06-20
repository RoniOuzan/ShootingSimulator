@echo off
title Shooting Simulator

echo =========================================
echo   Booting up Shooting Simulator...
echo =========================================
echo.

:: Navigate into the React frontend folder first
cd shootingsimulator-frontend

:: Check if node_modules exists, if not, run npm install automatically
if not exist "node_modules\" (
    echo [Setup] First time running on this PC. Installing dependencies...
    npm install
)

:: Launch the development servers
npm run dev