# Tonalite

## Required Features

- Save/load show
- Record and playback cues
- Change cue time

## Wanted Features

- Effects
- Follow cue
- Submasters
- Safe channels

## Implimented Features

None yet...

## Implimentation Details

### Safe channels

Two lists of channel values. The first is what is used for cues.
The second is used for safe channels.
When the sACN output is processed, the two will be compared and a new list created.
Foreach channel, whichever list has a greater value for that channel will be used.