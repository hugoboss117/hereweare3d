#!/bin/bash
cd "$(dirname "$0")"
(python3 -m http.server 8791 || python -m http.server 8791) &
sleep 1
chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://localhost:8791/index.html 2>/dev/null || xdg-open http://localhost:8791/index.html