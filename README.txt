Do NOT double-click index.html directly - it will show a blank page.
Local video + effects need to be served from a local web address, not opened as a bare file.

To run this show:
  - On Windows: double-click start-windows.bat
  - On a Raspberry Pi (or other Linux): run ./start-pi.sh (launches fullscreen kiosk mode if chromium-browser is installed)

Both scripts require Python 3 (or Python 2) to be installed, since they use it to run a small local file server.
If double-clicking the script does not work, open a terminal in this folder and run: python -m http.server 8791
then open http://localhost:8791/index.html in a browser yourself.

Note: video will stay stuck on its first frame if opened in a browser without
the --autoplay-policy=no-user-gesture-required flag (a normal double-click of a URL
does not pass this). start-windows.bat and start-pi.sh already launch Chrome/Edge/
Chromium with this flag automatically - if you open the page manually instead,
pass that flag yourself, e.g.: chrome.exe --autoplay-policy=no-user-gesture-required http://localhost:8791/index.html