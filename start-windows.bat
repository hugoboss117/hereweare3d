@echo off
cd /d "%~dp0"
start "Video Show Player - Local Server" cmd /c "python -m http.server 8791 || python3 -m http.server 8791"
timeout /t 1 /nobreak > nul
set BROWSER_EXE=
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set BROWSER_EXE="%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set BROWSER_EXE="%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if defined BROWSER_EXE (
  start "" %BROWSER_EXE% --autoplay-policy=no-user-gesture-required --new-window "http://localhost:8791/index.html"
) else (
  echo Could not find Chrome or Edge automatically - opening your default browser instead.
  echo Video may stay paused on the first frame there, since only Chrome/Edge support the flag this needs for unattended autoplay.
  start "" http://localhost:8791/index.html
)
echo Server running in the other window. Close it to stop.