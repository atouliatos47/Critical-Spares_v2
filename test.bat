@echo off
echo Testing Node.js location...
echo.

echo Current directory: %CD%
echo.

echo Checking for node-v24.14.0-win-x64 folder:
if exist "node-v24.14.0-win-x64" (
    echo ✅ Folder exists
) else (
    echo ❌ Folder does not exist
)
echo.

echo Checking for node.exe:
if exist "node-v24.14.0-win-x64\node.exe" (
    echo ✅ node.exe found
    echo.
    echo Version info:
    "node-v24.14.0-win-x64\node.exe" --version
) else (
    echo ❌ node.exe NOT found in that folder
    echo.
    echo Contents of the folder:
    dir "node-v24.14.0-win-x64"
)

pause