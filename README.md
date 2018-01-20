# Tonalite

Tonalite is a mobile lighting controller written in Python and JavaScript using SocketIO.

## Required Tools

Tonalite requires Python 3.6+, SASS, and the folowing libraries:

- python-socketio
- aiohttp
- PyInstaller
- passlib

### Run Tonalite

To run Tonalite, use the command `python3 tonalite.py`

### Create Executable

Create the PyInstaller release executable by running the command `python3 -m PyInstaller --onefile tonalite.spec`

If you have [UPX](https://upx.github.io/) installed, the build will be much faster and smaller.

## Feature Set

- [x] Save/load show
- [x] Record and playback cues
- [x] Change cue time
- [x] Follow cue
- [x] Submasters
- [x] Security and login
- [ ] Effects