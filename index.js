var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var e131 = require('e131');
var uDMX = require('./udmx');
var fs = require('fs');
var moment = require('moment');
var multer = require('multer');

// 0 = e1.31, 1 = udmx
var OUTPUT = 0;

var PROD = true;

/*
Tasks:
- Get Fixtures - Done - Done UI
- Get Fixture Profiles - Done - Done UI
- Add Fixture - Done - Done UI
- Remove Fixture - Done - Done UI
- Get Fixture Settings - Done - Done UI
- Edit Fixture Settings - Done - Done UI
- Get Fixture Channels - Done - Done UI
- Change Fixture Channel Value - Done - Done UI
- Reset Fixtures - Done - Done UI
- Get Cues - Done - Done UI
- Record Cue - Done - Done UI
- Get Cue Settings - Done - Done UI
- Update Cue - Done
- Edit Cue Settings - Done - Done UI
- Move Cue Up
- Move Cue Down
- Remove Cue - Done - Done UI
- Go To Next Cue - Done - Done UI
- Go To Last Cue - Done - Done UI
- Go To Specific Cue - Done - Done UI
- Stop Running Cue - Done - Done UI
- Add Fixture To Group
- Get All Channels In A Group
- Change Group Channel Value
- Get Group Settings
- Edit Group Settings
*/

if (OUTPUT == 1) {
    var dmx = new uDMX();
    dmx.connect();
    var channels = new Array(512).fill(0);
} else {
    var client = new e131.Client(1);
    var packet = client.createPacket(512);
    var slotsData = packet.getSlotsData();
    var channels = slotsData;
}

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/')
    },
    filename: function (req, file, cb) {
        cb(null, 'currentShow.json')
    }
})

var upload = multer({ storage: storage })

var fixtures = [];
var cues = [];
var currentCue = -1;
var lastCue = -1;

function mapRange(num, inMin, inMax, outMin, outMax) {
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function resetDMXValues() {
    channels.forEach(function (channel) {
        channel = 0;
    });
};

function calculateFixtures() {
    fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            channels[(fixture.startDMXAddress - 1) + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
        });
    });
};

function calculateCue(cue) {
    var outputChannels = new Array(512).fill(0);
    cue.fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel, i) {
            var startFixture = fixtures[fixtures.map(el => el.id).indexOf(fixture.id)];
            var startChannel = mapRange(startFixture.channels[i].value, startFixture.channels[i].displayMin, startFixture.channels[i].displayMax, startFixture.channels[i].min, startFixture.channels[i].max);
            var endChannel = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
            outputChannels[(fixture.startDMXAddress - 1) + channel.dmxAddress] = endChannel + (((startChannel - endChannel) / (cue.time * 40)) * cue.step);
        });
    });
    return outputChannels;
}

function calculateStack() {
    if (currentCue != -1) {
        cue = cues[currentCue];
        channels = calculateCue(cue);
        cue.step -= 1;
        if (cue.step < 0) {
            if (cue.follow != 0) {
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
            cue.fixtures.forEach(function (fixture) {
                fixture.channels.forEach(function (channel, i) {
                    fixtures[fixtures.map(el => el.id).indexOf(fixture.id)].channels[i].value = channel.value;
                });
            });
            io.sockets.emit('cues', cues);
        }
    }
    //stack.forEach(function (item) {
    // Calculate stack
    //});
};

function resetFixtures() {
    fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            channel.value = channel.defaultValue;
        });
    });
};

function dmxLoop() {
    resetDMXValues();
    calculateFixtures();
    calculateStack();
    if (OUTPUT == 1) {
        channels.forEach(function (value, i) {
            dmx.set(i + 1, value);
        });
    } else {
        slotsData = channels;
        client.send(packet);
    }
};

function saveShow() {
    fs.writeFile("./currentShow.json", JSON.stringify([fixtures, cues]), (err) => {
        if (err) {
            console.log(err);
            return false;
        };
    });
    return true;
};

console.log("Tonalite v2.0 - Wireless Lighting Control");
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.post('/', upload.single('show-file-to-upload'), (req, res) => {
    res.redirect('/');
});

app.get('/showFile', function (req, res) {
    saveShow();
    res.download("./currentShow.json", moment().format() + ".tonalite");
});

http.listen(3000, function () {
    console.log('Tonalite listening on *:3000');
});

// Output DMX frames 40 times a second
setInterval(dmxLoop, 25);

if (PROD) {
    // Auto-save the show every 30 minutes
    setInterval(saveShow, 1800000);
}

io.on('connection', function (socket) {
    socket.emit('fixtures', fixtures);
    socket.emit('cues', cues);
    socket.emit('cueActionBtn', false);

    socket.on('saveShow', function () {
        if (saveShow()) {
            socket.emit('message', { type: "info", content: "The show has been saved!" });
        } else {
            socket.emit('message', { type: "error", content: "The show could not be saved!" });
        }
    });

    socket.on('resetShow', function () {
        fixtures = [];
        cues = [];
        currentCue = -1;
        lastCue = -1;
        socket.emit('fixtures', fixtures);
        socket.emit('cues', cues);
        socket.emit('cueActionBtn', false);
        socket.emit('message', { type: "info", content: "The show has been reset!" });
    });

    socket.on('getFixtureProfiles', function () {
        var fixturesList = [];
        fs.readdir("./fixtures", (err, files) => {
            files.forEach(file => {
                fixturesList.push(file.slice(0, -5));
            });
            socket.emit('fixtureProfiles', fixturesList);
        });
    });

    socket.on('addFixture', function (msg) {
        // Add a fixture using the fixture spec file in the fixtures folder
        var fixture = require("./fixtures/" + msg.fixtureName + ".json");
        fixture.startDMXAddress = msg.startDMXAddress;
        // Assign a random id for easy access to this fixture
        fixture.id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        fixtures.push(JSON.parse(JSON.stringify(fixture)));
        io.emit('fixtures', fixtures);
    });

    socket.on('removeFixture', function (fixtureID) {
        if (fixtures.length != 0) {
            fixtures.splice(fixtures[fixtures.map(el => el.id).indexOf(fixtureID)], 1);
            socket.emit('message', { type: "info", content: "Fixture has been removed!" });
            io.emit('fixtures', fixtures);
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
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('changeFixtureChannelValue', function (msg) {
        if (fixtures.length != 0) {
            var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
            var channel = fixture.channels[msg.cid];
            channel.value = msg.value;
            socket.broadcast.emit('fixtures', fixtures);
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
                follow: 0,
                step: 120, // 3 * 40
                active: false,
                following: false,
                fixtures: JSON.parse(JSON.stringify(fixtures))
            };
            cues.push(newCue);
            io.emit('cues', cues);
        } else {
            socket.emit('message', { type: "error", content: "No fixtures exist!" });
        }
    });

    socket.on('updateCue', function (cueID) {
        if (cues.length != 0) {
            var cue = cues[cues.map(el => el.id).indexOf(cueID)];
            cue.fixtures = JSON.parse(JSON.stringify(fixtures));
            socket.emit('cueSettings', cue);
            socket.emit('message', { type: "info", content: "Cue channels have been updated!" });
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
            cue.follow = msg.follow;
            cue.step = msg.time * 40;
            socket.emit('cueSettings', cue);
            socket.emit('message', { type: "info", content: "Cue settings have been updated!" });
            io.emit('cues', cues);
        } else {
            socket.emit('message', { type: "error", content: "No cues exist!" });
        }
    });

    socket.on('removeCue', function (cueID) {
        if (cues.length != 0) {
            cues.splice(cues[cues.map(el => el.id).indexOf(cueID)], 1);
            if (currentCue == cues.map(el => el.id).indexOf(cueID)) {
                lastCue = -1;
                currentCue = lastCue;
                io.emit('cueActionBtn', false);
            }
            socket.emit('message', { type: "info", content: "Cue has been removed!" });
            io.emit('cues', cues);
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
});
