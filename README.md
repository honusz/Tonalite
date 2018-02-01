# Tonalite v1.0.0 [![Build status](https://ci.appveyor.com/api/projects/status/hsbnkhd9bt0u9631?svg=true)](https://ci.appveyor.com/project/johnroper100/tonalite)

![Tonalite Keyboard Interface](docs/images/keyboard.png)

Tonalite is a mobile E.131 lighting controller written in Python and JavaScript using SocketIO. It is built to be used with multiple devices for maximum mobility when programming lights. No need to sit in the light booth any more, just use your phone! The output is currently configured for 48 channels so as to keep overhead low, but this can be increased if needed.

This project uses the Semantic Versioning 2.0.0 system.

Please help me out by [donating some money](https://www.paypal.me/johnroper) to support this project.

## Required Tools

Tonalite requires Python 3.6+, SASS, and the folowing libraries:

- python-socketio
- aiohttp
- PyInstaller
- passlib
- cython
- socketIO-client (needed for testing)

## Run Tonalite

To run Tonalite, use the command `python3 tonalite.py`

## Create Executable

Build channelman and create the PyInstaller release executable by running the command `build.bat`

If you have [UPX](https://upx.github.io/) installed, the output will be much faster and smaller. *Please note that UPX is currently disabled due to a Windows build bug inside PyInstaller.*

## Feature Set

- [x] Save/load show
- [x] Record and playback cues
- [x] Follow cue
- [x] Submasters
- [x] Security and login
- [ ] Effects