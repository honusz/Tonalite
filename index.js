var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var moment = require('moment');
var fileUpload = require('express-fileupload');
const { spawn } = require('child_process');

// 0 = E1.31, 1 = uDMX, 2 = ArtNet
var OUTPUT = 1;

// 0 = linux64, 1 = rpi
var DEVICE = 0;

// http web UI location
var URL = "localhost";
var PORT = 3000;

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
- Channel Lock - Done
- Reset Fixtures - Done - Done UI
- Get Cues - Done - Done UI
- Record Cue - Done - Done UI
- Get Cue Settings - Done - Done UI
- Update Cue - Done
- Edit Cue Settings - Done - Done UI
- Clone Cue - Done - Done UI
- Move Cue Up - Done
- Move Cue Down - Done
- Remove Cue - Done - Done UI
- Go To Next Cue - Done - Done UI
- Go To Last Cue - Done - Done UI
- Go To Specific Cue - Done - Done UI
- Stop Running Cue - Done - Done UI
- Get Groups
- Add Group
- Get All Channels In A Group
- Change Group Channel Value
- Get Group Settings
- Edit Group Settings
- Save Show - Done - Done UI
- Open Show From File - Done - Done UI
- Save Show To File - Done - Done UI
- Import Fixture Definition File - Done - Done UI
*/

// If e1.31 selected, run that, but run artnet otherwise
if (OUTPUT == 0) {
    var e131 = require('e131');
    var client = new e131.Client(1);
    var packet = client.createPacket(512);
    var slotsData = packet.getSlotsData();
    var channels = slotsData;
} else {
    var artnet = require('artnet')({ host: '255.255.255.255' });
    var channels = new Array(512).fill(0);
}

var fixtures = [];
var cues = [];
var currentCue = -1;
var lastCue = -1;

// Convert a number in the input range to a number in the output range
function mapRange(num, inMin, inMax, outMin, outMax) {
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

var moveArrayItem = function (array, element, delta) {
    var index = array.indexOf(element);
    var newIndex = index + delta;
    if (newIndex < 0 || newIndex == array.length) return; // Already at the top or bottom.
    var indexes = [index, newIndex].sort(); // Sort the indixes
    array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]]); // Replace from lowest index, two elements, reverting the order
};

// Set the output channel values to those of the current fixture values
function calculateChannels() {
    fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            channels[(fixture.startDMXAddress - 1) + channel.dmxAddressOffset] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
        });
    });
};

// Set the cue's output channel values to the correct values from the fixtures. This is basically saving the cue.
function calculateCue(cue) {
    var outputChannels = new Array(512).fill(0);
    cue.fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel, i) {
            if (channel.locked == false) {
                var startFixture = fixtures[fixtures.map(el => el.id).indexOf(fixture.id)];
                var startChannel = mapRange(startFixture.channels[i].value, startFixture.channels[i].displayMin, startFixture.channels[i].displayMax, startFixture.channels[i].min, startFixture.channels[i].max);
                var endChannel = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
                outputChannels[(fixture.startDMXAddress - 1) + channel.dmxAddressOffset] = endChannel + (((startChannel - endChannel) / (cue.time * 40)) * cue.step);
                fixtures[fixtures.map(el => el.id).indexOf(fixture.id)].channels[i].displayValue = parseInt(channel.value + (((startFixture.channels[i].value - channel.value) / (cue.time * 40)) * cue.step));
            }
        });
    });
    return outputChannels;
}

function calculateStack() {
    // If there is a running cue
    if (currentCue != -1) {
        // Get the current cue
        cue = cues[currentCue];
        channels = calculateCue(cue);
        cue.step -= 1;
        // Check if the cue needs to be followed by another cue
        if (cue.step < 0) {
            if (cue.follow != -1) {
                cue.active = false;
                if (cue.following == false) {
                    cue.step = cue.follow * 40;
                    cue.following = true;
                } else {
                    cue.step = cue.time * 40;
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
                cue.step = cue.time * 40;
                cue.active = false;
                io.sockets.emit('cueActionBtn', false);
            }
            // Set the fixture's display and real values to the correct values from the cue
            cue.fixtures.forEach(function (fixture) {
                fixture.channels.forEach(function (channel, i) {
                    if (channel.locked == false) {
                        fixtures[fixtures.map(el => el.id).indexOf(fixture.id)].channels[i].value = channel.value;
                        fixtures[fixtures.map(el => el.id).indexOf(fixture.id)].channels[i].displayValue = channel.value;
                    }
                });
            });
            io.sockets.emit('cues', cues);
        }
        io.sockets.emit('fixtures', fixtures);
    }
    //stack.forEach(function (item) {
    // Calculate stack
    //});
};

// Reset the channel values for each fixture
function resetFixtures() {
    fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            channel.value = channel.defaultValue;
            channel.displayValue = channel.value;
        });
    });
};

// This is the output dmx loop. It gathers the channels and calculates what the output values should be.
function dmxLoop() {
    // Reset DMX values
    channels.forEach(function (channel) {
        channel = 0;
    });
    calculateChannels();
    calculateStack();

    // If e1.31 is selected, output to that, if not, use artnet
    if (OUTPUT == 0) {
        slotsData = channels;
        client.send(packet);
    } else {
        artnet.set(1, channels);
    }
};

// Save the fixtures and cues of the show to file
function saveShow() {
    fs.writeFile("./currentShow.json", JSON.stringify([fixtures, cues]), (err) => {
        if (err) {
            console.log(err);
            return false;
        };
    });
    return true;
};

// Load the fixtures and cues from file
function openShow() {
    fs.readFile('./currentShow.json', (err, data) => {
        if (err) throw err;
        let show = JSON.parse(data);
        fixtures = show[0];
        cues = show[1];
        io.sockets.emit('fixtures', fixtures);
        io.sockets.emit('cues', cues);
    });
}

console.log("Tonalite v2.0 - Wireless Lighting Control");

app.use('/static', express.static(__dirname + '/static'));
app.use(fileUpload());

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.min.html');
});

app.post('/', (req, res) => {
    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('No files were uploaded.');
    }
    let showFile = req.files.showFile;

    showFile.mv('./currentShow.json', function (err) {
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
        fixtureDefinition.mv('./fixtures/' + req.files.fixtureDefinition.name, function (err) {
            if (err)
                return res.status(500).send(err);
            io.emit('message', { type: "info", content: "The fixture profile has been imported!" });
        });
    } else {
        io.emit('message', { type: "error", content: "The fixture profile was not a json file!" });
    }
});

app.get('/showFile', function (req, res) {
    res.download('./currentShow.json', moment().format() + '.tonalite');
});

http.listen(PORT, URL, function () {
    console.log('Tonalite listening at http://' + URL + ':' + PORT);
});

if (OUTPUT == 1) {
    if (DEVICE == 0) {
        ls = spawn('uDMXArtnet/uDMXArtnet_minimal_64');
    } else if (DEVICE == 1) {
        ls = spawn('uDMXArtnet/uDMXArtnet_PI_minimal_32', ['-i', '192.168.4.1']);
    }
    ls.stdout.on('data', (data) => {
        console.log('udmx stdout: ' + data);
    });

    ls.stderr.on('data', (data) => {
        console.log('udmx stderr: ' + data);
    });

    ls.on('close', (code) => {
        console.log('udmx child process exited with code ${code}');
    });
}

// Output DMX frames 40 times a second
setInterval(dmxLoop, 25);

// If on the raspberry pi, turn on an led to show that the program is started
if (DEVICE == 1) {
    const Gpio = require('onoff').Gpio;
    const led = new Gpio(17, 'out');
    led.writeSync(1);
}

fs.exists('currentShow.json', function (exists) {
    if (exists == false) {
        saveShow();
    }
    openShow();
});

io.on('connection', function (socket) {
    socket.emit('fixtures', fixtures);
    socket.emit('cues', cues);
    socket.emit('cueActionBtn', false);

    socket.on('resetShow', function () {
        fixtures = [];
        cues = [];
        currentCue = -1;
        lastCue = -1;
        socket.emit('fixtures', fixtures);
        socket.emit('cues', cues);
        socket.emit('cueActionBtn', false);
        socket.emit('message', { type: "info", content: "The show has been reset!" });
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
        fs.readdir("./fixtures", (err, files) => {
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
                var fixture = require("./fixtures/" + msg.fixtureName + ".json");
                fixture.startDMXAddress = startDMXAddress;
                // Assign a random id for easy access to this fixture
                fixture.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                fixtures.push(JSON.parse(JSON.stringify(fixture)));
                startDMXAddress += fixture.channels.length;
            }

            io.emit('fixtures', fixtures);
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
            fixtures.splice(fixtures.map(el => el.id).indexOf(fixtureID), 1);
            socket.emit('message', { type: "info", content: "Fixture has been removed!" });
            io.emit('fixtures', fixtures);
            io.emit('cues', cues);
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
            io.emit('fixtures', fixtures);
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
            io.emit('fixtures', fixtures);
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
                channel.value = channel.defaultValue;
                channel.displayValue = channel.value;
            });
            socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
            io.emit('fixtures', fixtures);
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
            io.emit('fixtures', fixtures);
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('changeChannelLock', function (msg) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
            var channel = fixture.channels[msg.cid];
            channel.locked = !channel.locked;
            socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
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
                time: 3,
                follow: -1,
                step: 120, // 3 * 40
                active: false,
                following: false,
                fixtures: JSON.parse(JSON.stringify(fixtures))
            };
            cues.push(newCue);
            io.emit('cues', cues);
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
            io.emit('cues', cues);
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
            newCue.name = "Cue " + (cues.length + 1);
            cues.push(newCue);
            socket.emit('cueSettings', newCue);
            io.emit('cues', cues);
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
            cue.time = msg.time;
            if (msg.follow < -1) {
                cue.follow = -1;
            } else {
                cue.follow = msg.follow;
            }
            cue.step = msg.time * 40;
            socket.emit('cueSettings', cue);
            socket.emit('message', { type: "info", content: "Cue settings have been updated!" });
            io.emit('cues', cues);
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
            io.emit('cues', cues);
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('nextCue', function () {
        if (cues.length != 0) {
            if (lastCue != -1) {
                cues[lastCue].step = cues[lastCue].time * 40;
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
            io.emit('cues', cues);
            io.emit('cueActionBtn', true);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('lastCue', function () {
        if (cues.length != 0) {
            if (lastCue != -1) {
                cues[lastCue].step = cues[lastCue].time * 40;
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
            io.emit('cues', cues);
            io.emit('cueActionBtn', true);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('stopCue', function () {
        if (cues.length != 0) {
            currentCue = -1;
            cues[lastCue].step = cues[lastCue].time * 40;
            cues[lastCue].active = false;
            cues[lastCue].following = false;
            io.emit('cues', cues);
            io.emit('cueActionBtn', false);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('gotoCue', function (cueID) {
        if (cues.length != 0) {
            if (lastCue != -1) {
                cues[lastCue].step = cues[lastCue].time * 40;
                cues[lastCue].active = false;
                cues[lastCue].following = false;
            }
            lastCue = cues.map(el => el.id).indexOf(cueID);
            currentCue = lastCue;
            cues[lastCue].active = true;
            io.emit('cues', cues);
            io.emit('cueActionBtn', true);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('moveCueUp', function (cueID) {
        if (cues.length != 0) {
            moveArrayItem(cues, cues.map(el => el.id).indexOf(cueID), -1);
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('moveCueDown', function (cueID) {
        if (cues.length != 0) {
            moveArrayItem(cues, cues.map(el => el.id).indexOf(cueID), 1);
            saveShow();
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });
});
