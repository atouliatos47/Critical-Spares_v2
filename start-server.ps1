# PowerShell script to run Critical Spares with portable Node.js

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Critical Spares Tracker - Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Node.js path
$nodePath = Join-Path $PSScriptRoot "node-v24.14.0-win-x64"
$nodeExe = Join-Path $nodePath "node.exe"

if (-not (Test-Path $nodeExe)) {
    Write-Host "❌ Node.js not found at: $nodeExe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Expected Node.js portable version at: node-v24.14.0-win-x64\" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

# Check if server.js exists
$serverJs = Join-Path $PSScriptRoot "server.js"
if (-not (Test-Path $serverJs)) {
    Write-Host "❌ server.js not found in current directory!" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "✅ Using Node.js from: $nodePath" -ForegroundColor Green
Write-Host ""

# Get local IP addresses
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" }

Write-Host "Server will be available at:" -ForegroundColor Yellow
Write-Host "  http://localhost:3000" -ForegroundColor Cyan
foreach ($ip in $ips) {
    Write-Host "  http://$($ip.IPAddress):3000" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Set environment variable to use portable Node
$env:PATH = "$nodePath;$env:PATH"

# Run the server
& $nodeExe server.js

Read-Host "Press Enter to exit"