# Tonalite

Tonalite is a mobile lighting controller written in Python and JavaScript using SocketIO.

## Required Tools

Tonalite requires Python 3.6+ and the folowing libraries installed through pip:

- python-socketio
- aiohttp
- PyInstaller

### Create Executable

Create the PyInstaller release executable by running the command `python3 -m PyInstaller --onefile tonalite.spec`

If you have [UPX](https://upx.github.io/) installed, the build will be much faster and smaller.

## Feature Set

### Required Features

- [x] Save/load show
- [x] Record and playback cues
- [x] Change cue time
- [x] Mobile responsive

### Wanted Features

- [ ] Effects
- [x] Follow cue
- [ ] Submasters
- [ ] Safe channels
- [ ] Better cue transitions

### Implimentation Details

#### Safe channels

Two lists of channel values. The first is what is used for cues.
The second is used for safe channels.
When the sACN output is processed, the two will be compared and a new list created.
Foreach channel, whichever list has a greater value for that channel will be used.