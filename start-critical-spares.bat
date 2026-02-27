@echo off
echo ========================================
echo   Critical Spares Tracker - Launcher
echo ========================================
echo.

REM Set the path to your Node.js portable version
set NODE_HOME=.\node-v24.14.0-win-x64
set PATH=%NODE_HOME%;%PATH%

echo Using Node.js from: %NODE_HOME%
echo.

REM Check if server.js exists
if not exist "server.js" (
    echo ❌ server.js not found in current directory!
    echo.
    echo Please make sure server.js is in this folder.
    echo.
    pause
    exit /b
)

echo ✅ Starting server...
echo.
echo Server will be available at:
echo   http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Run the server with portable Node.js
node server.js

pause