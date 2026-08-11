@echo off
cd /d "%~dp0"
start "Video Show Player - Local Server" cmd /c "python -m http.server 8791 || python3 -m http.server 8791"
timeout /t 1 /nobreak > nul
start "" http://localhost:8791/index.html
echo Server running in the other window. Close it to stop.