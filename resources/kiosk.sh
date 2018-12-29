#!/bin/bash
# If Chrome crashes (usually due to rebooting), clear the crash flag so we don't have the annoying warning bar
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences
sudo ip link set eth0 up
sudo ip addr add 10.66.66.1/24 dev eth0
/usr/local/bin/npm start --prefix /home/pi/Tonalite &
chromium-browser --disable-pinch --overscroll-history-navagation=0 --kiosk http://10.66.66.1:3000
