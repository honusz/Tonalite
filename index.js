const app = require('express')();
const express = require('express');
const favicon = require('serve-favicon');
const compression = require('compression');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const moment = require('moment');
const fileUpload = require('express-fileupload');
const { spawn } = require('child_process');
const drivelist = require('drivelist');
const unzipper = require('unzipper');
require('sanic.js').changeMyWorld();

/*
Features:
- Get Fixtures - Done - Done UI
- Get Fixture Profiles - Done - Done UI
- Add Fixture - Done - Done UI
- Remove Fixture - Done - Done UI
- Get Fixture Settings - Done - Done UI
- Edit Fixture Settings - Done - Done UI
- Get Fixture Channels - Done - Done UI
- Change Fixture Channel Value - Done - Done UI
- Channel Lock - Done - Done UI
- Reset Fixtures - Done - Done UI
- Get Cues - Done - Done UI
- Record Cue - Done - Done UI
- Get Cue Settings - Done - Done UI
- Update Cue - Done - Done UI
- Edit Cue Settings - Done - Done UI
- Clone Cue - Done - Done UI
- Move Cue Up - Done - Done UI
- Move Cue Down - Done - Done UI
- Remove Cue - Done - Done UI
- Go To Next Cue - Done - Done UI
- Go To Last Cue - Done - Done UI
- Go To Specific Cue - Done - Done UI
- Stop Running Cue - Done - Done UI
- Get Groups - Done - Done UI
- Add Group - Done - Done UI
- Get Group Channels - Done - Done UI
- Change Group Channel Value - Done - Done UI
- Get Group Settings - Done - Done UI
- Edit Group Settings - Done - Done UI
- Remove Group - Done - Done UI
- Reset Group - Done - Done UI
- Reset Groups - Done - Done UI
- Save Show - Done - Done UI
- Open Show From File - Done - Done UI
- Save Show To File - Done - Done UI
- Import Fixture Definition File - Done - Done UI
- View Docs - Done - Done UI
- View Settings - Done - Done UI
- Save Settings - Done - Done UI
- Update Firmware - Done - Done UI
- View Presets - Done - Done UI
- Add Preset - Done - Done UI
- Edit Preset - Done - Done UI
- Activate/Deactivate Preset - Done UI
- Remove Preset - Done - Done UI
- Preset Kiosk Page - Done - Done UI
- Grandmaster
- Blackout button
*/

var SETTINGS = {
    output: "udmx", // e131, udmx, artnet
    device: "linux", // linux, rpi, win
    url: "localhost", // http web UI location
    port: 3000,
    defaultUpTime: 3,
    defaultDownTime: 3
}

var STARTED = false;

const VERSION = "2.0";

fs.exists(process.cwd() + '/settings.json', function (exists) {
    if (exists == false) {
        saveSettings();
    }
    openSettings();
});

var fixtures = [];
var cues = [];
var groups = [];
var presets = [];
var currentCue = -1;
var lastCue = -1;
var blackout= false;

// Set up dmx variables for integrations used later on
var e131 = null;
var client = null;
var packet = null;
var slotsData = null;
var channels = null;
var artnet = null;

// Load the Tonalite settings from file
function openSettings() {
    fs.readFile(process.cwd() + '/settings.json', (err, data) => {
        if (err) logError(err);
        var settings = JSON.parse(data);
        SETTINGS = settings;

        if (STARTED == false) {
            STARTED = true;

            // If e1.31 selected, run that, but run artnet otherwise
            if (SETTINGS.output == "e131") {
                e131 = require('e131');
                client = new e131.Client(1);
                packet = client.createPacket(512);
                slotsData = packet.getSlotsData();
                channels = slotsData;
            } else {
                if (SETTINGS.url != "localhost") {
                    artnet = require('artnet')({ iface: SETTINGS.url, host: '255.255.255.255' });
                } else {
                    artnet = require('artnet')({ host: '255.255.255.255' });
                }
                channels = new Array(512).fill(0);
            }

            fs.exists(process.cwd() + '/presets.json', function (exists) {
                if (exists == true) {
                    openPresets();
                }
            });

            http.listen(SETTINGS.port, SETTINGS.url, function () {
                console.log(`Tonalite v${VERSION} - DMX Lighting Control System`);
                console.log('The web UI can be found at http://' + SETTINGS.url + ':' + SETTINGS.port);
            });

            if (SETTINGS.output == "udmx") {
                if (SETTINGS.device == "linux") {
                    ls = spawn(process.cwd() + '/uDMXArtnet/uDMXArtnet_minimal_64');
                } else if (SETTINGS.device == "rpi") {
                    ls = spawn(process.cwd() + '/uDMXArtnet/uDMXArtnet_PI_minimal_32', ['-i', '192.168.4.1']);
                } else if (SETTINGS.device == "win") {
                    ls = spawn(process.cwd() + '/uDMXArtnet/uDMXArtnet_Minimal.exe');
                }
                ls.on('close', (code) => {
                    console.log('udmx child process exited with code ' + code);
                });
            }

            // Output DMX frames 40 times a second
            setInterval(dmxLoop, 25);

            // If on the raspberry pi, turn on an led to show that the program is started
            if (SETTINGS.device == "rpi") {
                const Gpio = require('onoff').Gpio;
                const led = new Gpio(17, 'out');
                led.writeSync(1);
            }
        }
    });
}

// Save the Tonalite settings to a file
function saveSettings() {
    fs.writeFile(process.cwd() + "/settings.json", JSON.stringify(SETTINGS, null, 4), (err) => {
        if (err) {
            logError(err);
            return false;
        };
    });
    return true;
};

function updateFirmware(callback) {
    var uploadComplete = false;

    drivelist.list((error, drives) => {
        if (error) {
            logError(error);
        }

        drives.forEach((drive) => {
            fs.exists(drive.mountpoints[0].path + "/tonalite.zip", function (exists) {
                if (exists) {
                    fs.createReadStream(drive.mountpoints[0].path + "/tonalite.zip").pipe(unzipper.Extract({ path: process.cwd() }));
                    uploadComplete = true;
                    return callback(uploadComplete);
                }
            });
        });
    });
}

function logError(msg) {
    var datetime = new Date();
    fs.appendFile('error-' + datetime + '.txt', msg, function (err) {
        if (err) logError(err);
    });
}

// Convert a number in the input range to a number in the output range
function mapRange(num, inMin, inMax, outMin, outMax) {
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function moveArrayItem(array, element, delta) {
    var index = element;
    var newIndex = index + delta;
    if (newIndex < 0 || newIndex == array.length) return; // Already at the top or bottom.
    var indexes = [index, newIndex].sort(); // Sort the indixes
    array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]]); // Replace from lowest index, two elements, reverting the order
};

function titleCase(str) {
    return str.toLowerCase().split(' ').map(function (word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}

function cleanFixtures() {
    var newFixtures = JSON.parse(JSON.stringify(fixtures));
    let f = 0; const fMax = newFixtures.length; for (; f < fMax; f++) {
        let c = 0; const cMax = newFixtures[f].channels.length; for (; c < cMax; c++) {
            delete newFixtures[f].channels[c].max;
            delete newFixtures[f].channels[c].min;
            delete newFixtures[f].channels[c].defaultValue;
            delete newFixtures[f].channels[c].dmxAddressOffset;
        }
    }
    return newFixtures;
}

function cleanGroups() {
    var newGroups = JSON.parse(JSON.stringify(groups));
    let g = 0; const gMax = newGroups.length; for (; g < gMax; g++) {
        delete newGroups[g].ids;
        let c = 0; const cMax = newGroups[g].channels.length; for (; c < cMax; c++) {
            delete newGroups[g].channels[c].max;
            delete newGroups[g].channels[c].min;
            delete newGroups[g].channels[c].defaultValue;
            delete newGroups[g].channels[c].dmxAddressOffset;
        }
    }
    return newGroups;
}

function cleanCues() {
    var newCues = JSON.parse(JSON.stringify(cues));
    let c = 0; const cMax = newCues.length; for (; c < cMax; c++) {
        delete newCues[c].type;
        delete newCues[c].upTime;
        delete newCues[c].downTime;
        delete newCues[c].follow;
        delete newCues[c].upStep;
        delete newCues[c].downStep;
        delete newCues[c].following;
        delete newCues[c].fixtures;
    }
    return newCues;
}

function cleanPresets() {
    var newPresets = JSON.parse(JSON.stringify(presets));
    let p = 0; const pMax = newPresets.length; for (; p < pMax; p++) {
        delete newPresets[p].channels;
    }
    return newPresets;
}

// Set the output channel values to those of the current fixture values
function calculateChannels() {
    let f = 0; const fMax = fixtures.length; for (; f < fMax; f++) {
        let c = 0; const cMax = fixtures[f].channels.length; for (; c < cMax; c++) {
            channels[(fixtures[f].startDMXAddress - 1) + fixtures[f].channels[c].dmxAddressOffset] = mapRange(fixtures[f].channels[c].value, fixtures[f].channels[c].displayMin, fixtures[f].channels[c].displayMax, fixtures[f].channels[c].min, fixtures[f].channels[c].max);
        }
    }
};

// Set the cue's output channel values to the correct values from the fixtures. This is basically saving the cue.
function calculateCue(cue) {
    var outputChannels = new Array(512).fill(0);
    let f = 0; const fMax = cue.fixtures.length; for (; f < fMax; f++) {
        let c = 0; const cMax = cue.fixtures[f].channels.length; for (; c < cMax; c++) {
            var startFixture = fixtures[fixtures.map(el => el.id).indexOf(cue.fixtures[f].id)];
            if (startFixture.channels[c].locked == false) {
                var startChannel = mapRange(startFixture.channels[c].value, startFixture.channels[c].displayMin, startFixture.channels[c].displayMax, startFixture.channels[c].min, startFixture.channels[c].max);
                var endChannel = mapRange(cue.fixtures[f].channels[c].value, cue.fixtures[f].channels[c].displayMin, cue.fixtures[f].channels[c].displayMax, cue.fixtures[f].channels[c].min, cue.fixtures[f].channels[c].max);
                // If the end channel is greater than the start channel, the value is going in, out is going out if less
                if (endChannel >= startChannel) {
                    // Make sure that the step does not dip below 0 (finished)
                    if (cue.upStep >= 0) {
                        outputChannels[(cue.fixtures[f].startDMXAddress - 1) + cue.fixtures[f].channels[c].dmxAddressOffset] = endChannel + (((startChannel - endChannel) / (cue.upTime * 40)) * cue.upStep);
                        fixtures[fixtures.map(el => el.id).indexOf(cue.fixtures[f].id)].channels[c].displayValue = parseInt(cue.fixtures[f].channels[c].value + (((startFixture.channels[c].value - cue.fixtures[f].channels[c].value) / (cue.upTime * 40)) * cue.upStep));
                    }
                } else {
                    // Make sure that the step does not dip below 0 (finished)
                    if (cue.downStep >= 0) {
                        outputChannels[(cue.fixtures[f].startDMXAddress - 1) + cue.fixtures[f].channels[c].dmxAddressOffset] = endChannel + (((startChannel - endChannel) / (cue.downTime * 40)) * cue.downStep);
                        fixtures[fixtures.map(el => el.id).indexOf(cue.fixtures[f].id)].channels[c].displayValue = parseInt(cue.fixtures[f].channels[c].value + (((startFixture.channels[c].value - cue.fixtures[f].channels[c].value) / (cue.downTime * 40)) * cue.downStep));
                    }
                }
            } else {
                var startChannel = mapRange(startFixture.channels[c].value, startFixture.channels[c].displayMin, startFixture.channels[c].displayMax, startFixture.channels[c].min, startFixture.channels[c].max);
                outputChannels[(cue.fixtures[f].startDMXAddress - 1) + cue.fixtures[f].channels[c].dmxAddressOffset] = startChannel;
            }
        }
    }
    return outputChannels;
}

function calculateStack() {
    // If there is a running cue
    if (currentCue != -1) {
        // Get the current cue
        cue = cues[currentCue];
        channels = calculateCue(cue);
        cue.upStep -= 1;
        cue.downStep -= 1;
        // Check if the cue needs to be followed by another cue
        if (cue.upStep < 0 || cue.downStep < 0) {
            if (cue.follow != -1) {
                cue.active = false;
                if (cue.following == false) {
                    cue.upStep = cue.follow * 40;
                    cue.downStep = cue.follow * 40;
                    cue.following = true;
                } else {
                    cue.upStep = cue.upTime * 40;
                    cue.downStep = cue.downTime * 40;
                    cue.following = false;
                    if (currentCue == cues.length - 1) {
                        currentCue = 0;
                    } else {
                        currentCue += 1;
                    }
                    lastCue = currentCue;
                    cues[currentCue].active = true;
                }
            } else {
                currentCue = -1;
                cue.upStep = cue.upTime * 40;
                cue.downStep = cue.downTime * 40;
                cue.active = false;
                io.emit('cueActionBtn', false);
            }
            // Set the fixture's display and real values to the correct values from the cue
            let f = 0; const fMax = cue.fixtures.length; for (; f < fMax; f++) {
                let c = 0; const cMax = cue.fixtures[f].channels.length; for (; c < cMax; c++) {
                    var startFixtureChannels = fixtures[fixtures.map(el => el.id).indexOf(cue.fixtures[f].id)].channels;
                    if (startFixtureChannels[c].locked == false) {
                        startFixtureChannels[c].value = cue.fixtures[f].channels[c].value;
                        startFixtureChannels[c].displayValue = cue.fixtures[f].channels[c].value;
                    }
                }
            }
            io.sockets.emit('cues', cleanCues());
        }
        io.sockets.emit('fixtures', cleanFixtures());
    }
    // Allow presets to overide everything else for channels in which they have higher values
    let p = 0; const pMax = presets.length; for (; p < pMax; p++) {
        let c = 0; const cMax = presets[p].channels.length; for (; c < cMax; c++) {
            if (presets[p].active) {
                if (presets[p].channels[c] > channels[c]) {
                    channels[c] = presets[p].channels[c];
                }
            }
        }
    }
    //let s = 0; const sMax = stack.length; for (; s < sMax; s++) {
    // Calculate stack
    //}
};

// Set the fixture values for each group equal to the group's channel value
function setFixtureGroupValues(group, channel) {
    let i = 0; const iMax = group.ids.length; for (; i < iMax; i++) {
        var fixture = fixtures[fixtures.map(el => el.id).indexOf(group.ids[i])];
        let c = 0; const cMax = fixture.channels.length; for (; c < cMax; c++) {
            if (fixture.channels[c].type == channel.type && fixture.channels[c].subtype == channel.subtype) {
                if (fixture.channels[c].locked != true) {
                    fixture.channels[c].value = channel.value;
                    fixture.channels[c].displayValue = fixture.channels[c].value;
                }
            }
        }
    }
}

// Reset the channel values for each fixture
function resetFixtures() {
    let f = 0; const fMax = fixtures.length; for (; f < fMax; f++) {
        let c = 0; const cMax = fixtures[f].channels.length; for (; c < cMax; c++) {
            if (fixtures[f].channels[c].locked != true) {
                fixtures[f].channels[c].value = fixtures[f].channels[c].defaultValue;
                fixtures[f].channels[c].displayValue = fixtures[f].channels[c].value;
            }
        }
    }
};

// Reset the channel values for each group
function resetGroups() {
    let g = 0; const gMax = groups.length; for (; g < gMax; g++) {
        let c = 0; const cMax = groups[g].channels.length; for (; c < cMax; c++) {
            groups[g].channels[c].value = groups[g].channels[c].defaultValue;
            groups[g].channels[c].displayValue = groups[g].channels[c].value;
            setFixtureGroupValues(groups[g], groups[g].channels[c]);
        }
    }
};

// This is the output dmx loop. It gathers the channels and calculates what the output values should be.
function dmxLoop() {
    // Reset DMX values
    let c = 0; const cMax = channels.length; for (; c < cMax; c++) {
        channels[c] = 0;
    }
    if (blackout == false) {
        calculateChannels();
        calculateStack();
    }

    // If e1.31 is selected, output to that, if not, use artnet
    if (SETTINGS.output == "e131") {
        slotsData = channels;
        client.send(packet);
    } else {
        artnet.set(1, channels);
    }
};

// Load the fixtures, cues, and groups from file
function openShow() {
    fs.readFile(process.cwd() + '/show.json', (err, data) => {
        if (err) logError(err);
        let show = JSON.parse(data);
        fixtures = show[0];
        cues = show[1];
        groups = show[2];
        io.emit('fixtures', cleanFixtures());
        io.emit('cues', cleanCues());
        io.emit('groups', cleanGroups());
    });
}

// Save the fixtures, cues, and groups of the show to file
function saveShow() {
    fs.writeFile(process.cwd() + "/show.json", JSON.stringify([fixtures, cues, groups]), (err) => {
        if (err) {
            logError(err);
            return false;
        };
    });
    return true;
}

// Load the presets from file
function openPresets() {
    fs.readFile(process.cwd() + '/presets.json', (err, data) => {
        if (err) logError(err);
        presets = JSON.parse(data);
        io.emit('presets', cleanPresets());
    });
}

// Save the presets to file
function savePresets() {
    fs.writeFile(process.cwd() + "/presets.json", JSON.stringify(presets), (err) => {
        if (err) {
            logError(err);
            return false;
        };
    });
    return true;
}

app.use('/static', express.static(__dirname + '/static'));
app.use(fileUpload());
app.use(compression());
app.use(favicon(__dirname + '/static/favicon.ico'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.min.html');
});

app.get('/presets', function (req, res) {
    res.sendFile(__dirname + '/presets.min.html');
});

app.get('/docs', function (req, res) {
    res.sendFile(process.cwd() + '/docs/documentation.pdf');
});

app.get('/showFile', function (req, res) {
    res.download(process.cwd() + '/show.json', moment().format() + '.tonalite');
});

// Upload Show File
app.post('/showFile', (req, res) => {
    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('No files were uploaded.');
    }
    let showFile = req.files.showFile;

    showFile.mv(process.cwd() + '/show.json', function (err) {
        if (err)
            return res.status(500).send(err);
        openShow();
        res.redirect('/');
    });
});

app.post('/importFixtureDefinition', (req, res) => {
    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('No files were uploaded.');
    }
    let fixtureDefinition = req.files.fixtureDefinition;

    if (fixtureDefinition.mimetype == "application/json") {
        fixtureDefinition.mv(process.cwd() + '/fixtures/' + req.files.fixtureDefinition.name, function (err) {
            if (err)
                return res.status(500).send(err);
            io.emit('message', { type: "info", content: "The fixture profile has been imported!" });
        });
    } else {
        io.emit('message', { type: "error", content: "The fixture profile was not a json file!" });
    }
});

fs.exists(process.cwd() + '/show.json', function (exists) {
    if (exists == false) {
        saveShow();
    }
    openShow();
});

io.on('connection', function (socket) {
    socket.emit('fixtures', cleanFixtures());
    socket.emit('cues', cleanCues());
    socket.emit('groups', cleanGroups());
    socket.emit('presets', cleanPresets());
    socket.emit('blackout', blackout);

    if (currentCue == -1) {
        io.emit('cueActionBtn', false);
    } else {
        io.emit('cueActionBtn', true);
    }

    socket.on('resetShow', function () {
        fixtures = [];
        cues = [];
        groups = [];
        currentCue = -1;
        lastCue = -1;
        io.emit('fixtures', cleanFixtures());
        io.emit('cues', cleanCues());
        io.emit('groups', cleanGroups());
        io.emit('cueActionBtn', false);
        io.emit('message', { type: "info", content: "The show has been reset!" });
        saveShow();
    });

    socket.on('getFixtureProfiles', function () {
        var fixturesList = [];
        var startDMXAddress = 1;
        fixtures.forEach(function (fixture) {
            if (fixture.startDMXAddress == startDMXAddress) {
                startDMXAddress = fixture.startDMXAddress + fixture.channels.length;
            }
        });
        fs.readdir(process.cwd() + "/fixtures", (err, files) => {
            files.forEach(file => {
                fixturesList.push(file.slice(0, -5));
            });
            socket.emit('fixtureProfiles', [fixturesList, startDMXAddress]);
        });
    });

    socket.on('addFixture', function (msg) {
        var startDMXAddress = msg.startDMXAddress;
        fixtures.forEach(function (fixture) {
            if (fixture.startDMXAddress == startDMXAddress) {
                startDMXAddress = null;
            }
        });
        if (startDMXAddress) {
            for (var i = 0; i < msg.creationCount; i++) {
                // Add a fixture using the fixture spec file in the fixtures folder
                var fixture = require(process.cwd() + "/fixtures/" + msg.fixtureName + ".json");
                fixture.startDMXAddress = startDMXAddress;
                fixture.hasLockedChannels = false;
                // Assign a random id for easy access to this fixture
                fixture.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                fixtures.push(JSON.parse(JSON.stringify(fixture)));
                startDMXAddress += fixture.channels.length;
            }

            io.emit('fixtures', cleanFixtures());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "A fixture with this starting DMX address already exists!" });
        }
    });

    socket.on('removeFixture', function (fixtureID) {
        if (fixtures.length != 0) {
            cues.forEach(function (cue) {
                if (cue.fixtures.some(e => e.id === fixtureID)) {
                    cue.fixtures.splice(cue.fixtures.map(el => el.id).indexOf(fixtureID), 1);
                    if (cue.fixtures.length == 0) {
                        cues.splice(cues.map(el => el.id).indexOf(cue.id), 1);
                    }
                }
            });
            fixtures[fixtures.map(el => el.id).indexOf(fixtureID)].channels.forEach(function (channel) {
                channels[(fixtures[fixtures.map(el => el.id).indexOf(fixtureID)].startDMXAddress - 1) + channel.dmxAddressOffset] = 0;
            });
            fixtures.splice(fixtures.map(el => el.id).indexOf(fixtureID), 1);
            socket.emit('message', { type: "info", content: "Fixture has been removed!" });
            io.emit('fixtures', cleanFixtures());
            io.emit('cues', cleanCues());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('getFixtureSettings', function (fixtureID) {
        if (fixtures.length != 0) {
            socket.emit('fixtureSettings', fixtures[fixtures.map(el => el.id).indexOf(fixtureID)]);
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('editFixtureSettings', function (msg) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
            fixture.name = msg.name;
            fixture.shortName = msg.shortName;
            fixture.startDMXAddress = msg.startDMXAddress;
            socket.emit('fixtureSettings', fixture);
            socket.emit('message', { type: "info", content: "Fixture settings have been updated!" });
            io.emit('fixtures', cleanFixtures());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('getFixtureChannels', function (fixtureID) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(fixtureID)];
            socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('resetFixtures', function () {
        if (fixtures.length != 0) {
            resetFixtures();
            resetGroups();
            io.emit('fixtures', cleanFixtures());
            socket.emit('message', { type: "info", content: "Fixture values have been reset!" });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('resetFixture', function (fixtureID) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(fixtureID)];
            fixture.channels.forEach(function (channel) {
                if (channel.locked != true) {
                    channel.value = channel.defaultValue;
                    channel.displayValue = channel.value;
                }
            });
            socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
            io.emit('fixtures', cleanFixtures());
            socket.emit('message', { type: "info", content: "Fixture values reset!" });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('changeFixtureChannelValue', function (msg) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
            var channel = fixture.channels[msg.cid];
            channel.value = msg.value;
            channel.displayValue = channel.value;
            io.emit('fixtures', cleanFixtures());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('changeFixtureChannelLock', function (msg) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
            var channel = fixture.channels[msg.cid];
            channel.locked = !channel.locked;
            fixture.hasLockedChannels = false;
            fixture.channels.forEach(function (chan) {
                if (chan.locked) {
                    fixture.hasLockedChannels = true;
                }
            });
            socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
            io.emit('fixtures', cleanFixtures());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('recordCue', function () {
        if (fixtures.length != 0) {
            var newCue = {
                id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
                type: "cue",
                name: "Cue " + (cues.length + 1),
                upTime: SETTINGS.defaultUpTime,
                downTime: SETTINGS.defaultDownTime,
                follow: -1,
                upStep: SETTINGS.defaultUpTime * 40,
                downStep: SETTINGS.defaultDownTime * 40,
                active: false,
                following: false,
                fixtures: JSON.parse(JSON.stringify(fixtures))
            };
            cues.push(newCue);
            io.emit('cues', cleanCues());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('updateCue', function (cueID) {
        if (cues.length != 0) {
            var cue = cues[cues.map(el => el.id).indexOf(cueID)];
            cue.fixtures = JSON.parse(JSON.stringify(fixtures));
            socket.emit('cueSettings', cue);
            io.emit('cues', cleanCues());
            socket.emit('message', { type: "info", content: "Cue channels have been updated!" });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('cloneCue', function (cueID) {
        if (cues.length != 0) {
            var newCue = JSON.parse(JSON.stringify(cues[cues.map(el => el.id).indexOf(cueID)]));
            newCue.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            cues.push(newCue);
            socket.emit('cueSettings', newCue);
            io.emit('cues', cleanCues());
            socket.emit('message', { type: "info", content: "Cue has been cloned!" });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('getCueSettings', function (cueID) {
        if (cues.length != 0) {
            socket.emit('cueSettings', cues[cues.map(el => el.id).indexOf(cueID)]);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('editCueSettings', function (msg) {
        if (cues.length != 0) {
            var cue = cues[cues.map(el => el.id).indexOf(msg.id)];
            cue.name = msg.name;
            cue.upTime = msg.upTime;
            cue.downTime = msg.downTime;
            if (msg.follow < -1) {
                cue.follow = -1;
            } else {
                cue.follow = msg.follow;
            }
            cue.upStep = cue.upTime * 40;
            cue.downStep = cue.downTime * 40;
            socket.emit('cueSettings', cue);
            socket.emit('message', { type: "info", content: "Cue settings have been updated!" });
            io.emit('cues', cleanCues());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('removeCue', function (cueID) {
        if (cues.length != 0) {
            cues.splice(cues.map(el => el.id).indexOf(cueID), 1);
            if (currentCue == cues.map(el => el.id).indexOf(cueID)) {
                lastCue = -1;
                currentCue = lastCue;
                io.emit('cueActionBtn', false);
            }
            socket.emit('message', { type: "info", content: "Cue has been removed!" });
            io.emit('cues', cleanCues());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('nextCue', function () {
        if (cues.length != 0) {
            if (lastCue != -1) {
                cues[lastCue].upStep = cues[lastCue].upTime * 40;
                cues[lastCue].downStep = cues[lastCue].downTime * 40;
                cues[lastCue].active = false;
                cues[lastCue].following = false;
                if (lastCue == cues.length - 1) {
                    lastCue = 0;
                } else {
                    lastCue += 1;
                }
            } else {
                lastCue = 0;
            }
            currentCue = lastCue;
            cues[lastCue].active = true;
            io.emit('cues', cleanCues());
            io.emit('cueActionBtn', true);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('lastCue', function () {
        if (cues.length != 0) {
            if (lastCue != -1) {
                cues[lastCue].upStep = cues[lastCue].upTime * 40;
                cues[lastCue].downStep = cues[lastCue].downTime * 40;
                cues[lastCue].active = false;
                cues[lastCue].following = false;
                if (lastCue == 0) {
                    lastCue = cues.length - 1;
                } else {
                    lastCue -= 1;
                }
            } else {
                lastCue = cues.length - 1;
            }
            currentCue = lastCue;
            cues[lastCue].active = true;
            io.emit('cues', cleanCues());
            io.emit('cueActionBtn', true);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('stopCue', function () {
        if (cues.length != 0) {
            currentCue = -1;
            cues[lastCue].upStep = cues[lastCue].upTime * 40;
            cues[lastCue].downStep = cues[lastCue].downTime * 40;
            cues[lastCue].active = false;
            cues[lastCue].following = false;
            io.emit('cues', cleanCues());
            io.emit('cueActionBtn', false);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('gotoCue', function (cueID) {
        if (cues.length != 0) {
            if (lastCue != -1) {
                cues[lastCue].upStep = cues[lastCue].upTime * 40;
                cues[lastCue].downStep = cues[lastCue].downTime * 40;
                cues[lastCue].active = false;
                cues[lastCue].following = false;
            }
            lastCue = cues.map(el => el.id).indexOf(cueID);
            currentCue = lastCue;
            cues[lastCue].active = true;
            io.emit('cues', cleanCues());
            io.emit('cueActionBtn', true);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('moveCueUp', function (cueID) {
        if (cues.length != 0) {
            moveArrayItem(cues, cues.map(el => el.id).indexOf(cueID), -1);
            io.emit('cues', cleanCues());
            socket.emit('message', { type: "info", content: "Cue moved up." });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('moveCueDown', function (cueID) {
        if (cues.length != 0) {
            moveArrayItem(cues, cues.map(el => el.id).indexOf(cueID), 1);
            io.emit('cues', cleanCues());
            socket.emit('message', { type: "info", content: "Cue moved down." });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('addGroup', function (fixtureIDs) {
        var newGroup = {
            id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            name: "Group " + (groups.length + 1),
            shortName: "Group " + (groups.length + 1),
            ids: fixtureIDs,
            channels: []
        };
        var channelCats = [];
        newGroup.ids.forEach(function (fixtureID) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(fixtureID)];
            fixture.channels.forEach(function (channel) {
                var newChannel = JSON.parse(JSON.stringify(channel));
                if (!channelCats.includes(newChannel.type + ":" + newChannel.subtype)) {
                    newChannel.value = newChannel.defaultValue;
                    if (newChannel.subtype != "") {
                        newChannel.name = titleCase(newChannel.subtype);
                    } else {
                        newChannel.name = titleCase(newChannel.type);
                    }
                    newGroup.channels.push(newChannel);
                    channelCats.push(newChannel.type + ":" + newChannel.subtype);
                }
            });
        });
        groups.push(newGroup);
        io.emit('groups', cleanGroups());
        saveShow();
    });

    socket.on('getGroupChannels', function (groupID) {
        if (groups.length != 0) {
            var group = groups[groups.map(el => el.id).indexOf(groupID)];
            socket.emit('groupChannels', { id: group.id, name: group.name, channels: group.channels });
        } else {
            socket.emit('message', { type: "error", content: "No groups exist!" });
        }
    });

    socket.on('changeGroupChannelValue', function (msg) {
        if (fixtures.length != 0 && groups.length != 0) {
            var group = groups[groups.map(el => el.id).indexOf(msg.id)];
            var channel = group.channels[msg.cid];
            channel.value = msg.value;
            channel.displayValue = channel.value;
            setFixtureGroupValues(group, channel);
            io.emit('fixtures', cleanFixtures());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures or groups exist!" });
        }
    });

    socket.on('getGroupSettings', function (groupID) {
        if (groups.length != 0) {
            socket.emit('groupSettings', groups[groups.map(el => el.id).indexOf(groupID)]);
        } else {
            socket.emit('message', { type: "error", content: "No groups exist!" });
        }
    });

    socket.on('editGroupSettings', function (msg) {
        if (groups.length != 0) {
            var group = groups[groups.map(el => el.id).indexOf(msg.id)];
            group.name = msg.name;
            group.shortName = msg.shortName;
            socket.emit('groupSettings', group);
            socket.emit('message', { type: "info", content: "Group settings have been updated!" });
            io.emit('groups', cleanGroups());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No groups exist!" });
        }
    });

    socket.on('removeGroup', function (groupID) {
        if (groups.length != 0) {
            groups.splice(groups.map(el => el.id).indexOf(groupID), 1);
            socket.emit('message', { type: "info", content: "Group has been removed!" });
            io.emit('groups', cleanGroups());
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No groups exist!" });
        }
    });

    socket.on('resetGroup', function (groupID) {
        if (groups.length != 0) {
            var group = groups[groups.map(el => el.id).indexOf(groupID)];
            group.channels.forEach(function (channel) {
                channel.value = channel.defaultValue;
                channel.displayValue = channel.value;
                setFixtureGroupValues(group, channel);
            });
            socket.emit('groupChannels', { id: group.id, name: group.name, channels: group.channels });
            io.emit('fixtures', cleanFixtures());
            socket.emit('message', { type: "info", content: "Group channels reset!" });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No groups exist!" });
        }
    });

    socket.on('resetGroups', function () {
        if (groups.length != 0) {
            resetGroups();
            io.emit('fixtures', cleanFixtures());
            socket.emit('message', { type: "info", content: "Group values have been reset!" });
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('recordPreset', function () {
        if (fixtures.length != 0) {
            var newPreset = {
                id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
                name: "Preset " + (presets.length + 1),
                active: false,
                channels: JSON.parse(JSON.stringify(channels))
            };
            presets.push(newPreset);
            io.emit('presets', cleanPresets());
            savePresets();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('updatePreset', function (presetID) {
        if (presets.length != 0) {
            var preset = presets[presets.map(el => el.id).indexOf(presetID)];
            preset.fixtures = JSON.parse(JSON.stringify(fixtures));
            socket.emit('presetSettings', preset);
            io.emit('presets', cleanPresets());
            socket.emit('message', { type: "info", content: "Preset channels have been updated!" });
            savePresets();
        } else {
            socket.emit('message', { type: "error", content: "No presets exist!" });
        }
    });

    socket.on('getPresetSettings', function (presetID) {
        if (presets.length != 0) {
            socket.emit('presetSettings', presets[presets.map(el => el.id).indexOf(presetID)]);
        } else {
            socket.emit('message', { type: "error", content: "No presets exist!" });
        }
    });

    socket.on('editPresetSettings', function (msg) {
        if (presets.length != 0) {
            var preset = presets[presets.map(el => el.id).indexOf(msg.id)];
            preset.name = msg.name;
            socket.emit('presetSettings', preset);
            socket.emit('message', { type: "info", content: "Preset settings have been updated!" });
            io.emit('presets', cleanPresets());
            savePresets();
        } else {
            socket.emit('message', { type: "error", content: "No presets exist!" });
        }
    });

    socket.on('removePreset', function (presetID) {
        if (presets.length != 0) {
            presets.splice(presets.map(el => el.id).indexOf(presetID), 1);
            socket.emit('message', { type: "info", content: "Preset has been removed!" });
            io.emit('presets', cleanPresets());
            savePresets();
        } else {
            socket.emit('message', { type: "error", content: "No presets exist!" });
        }
    });

    socket.on('changePresetActive', function (presetID) {
        if (presets.length != 0) {
            var preset = presets[presets.map(el => el.id).indexOf(presetID)];
            preset.active = !preset.active;
            socket.emit('presetSettings', preset);
            socket.emit('presets', cleanPresets());
            io.emit('presets', cleanPresets());
            savePresets();
        } else {
            socket.emit('message', { type: "error", content: "No presets exist!" });
        }
    });

    socket.on('toggleBlackout', function () {
        blackout = !blackout;
        socket.emit('blackout', blackout);
        io.emit('blackout', blackout);
    });

    socket.on('getSettings', function () {
        socket.emit('settings', SETTINGS);
    });

    socket.on('saveSettings', function (msg) {
        SETTINGS.url = msg.url;
        SETTINGS.port = msg.port;
        SETTINGS.defaultUpTime = msg.defaultUpTime;
        SETTINGS.defaultDownTime = msg.defaultDownTime;
        if (saveSettings()) {
            socket.emit('message', { type: "info", content: "The Tonalite settings have been saved please reboot or restart if you have edited the server options." });
        } else {
            socket.emit('message', { type: "error", content: "The Tonalite settings file could not be saved on disk." });
        }
    });

    socket.on('updateFirmware', function () {
        updateFirmware(function (result) {
            if (result) {
                socket.emit('message', { type: "info", content: "The Tonalite firmware has been updated. Please restart the server." });
            }
        });
    });
});
