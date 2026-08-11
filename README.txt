Do NOT double-click index.html directly - it will show a blank page.
Local video + effects need to be served from a local web address, not opened as a bare file.

To run this show:
  - On Windows: double-click start-windows.bat
  - On a Raspberry Pi (or other Linux): run ./start-pi.sh (launches fullscreen kiosk mode if chromium-browser is installed)

Both scripts require Python 3 (or Python 2) to be installed, since they use it to run a small local file server.
If double-clicking the script does not work, open a terminal in this folder and run: python -m http.server 8791
then open http://localhost:8791/index.html in a browser yourself.