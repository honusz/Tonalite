var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var e131 = require('e131');
var uDMX = require('./udmx');
var fs = require('fs');

// 0 = e1.31, 1 = udmx
var OUTPUT = 1;

/*
Tasks:
- Get Fixtures - Done
- Get Fixture Profiles - Done
- Add Fixture - Done
- Remove Fixture - Done
- Get Fixture Settings - Done
- Edit Fixture Settings - Done
- Get Fixture Channels - Done
- Change Fixture Channel Value - Done
- Reset Fixtures - Done
- Record Cue - Done
- Get Cue Settings - Done
- Update Cue - Done
- Edit Cue Settings - Done
- Move Cue Up
- Move Cue Down
- Remove Cue - Done
- Go To Next Cue
- Go To Last Cue
- Go To Specific Cue
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

var fixtures = [];
var cues = [];
var stack = [];
var currentCue = -1;

function mapRange(num, inMin, inMax, outMin, outMax) {
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function resetDMXValues() {
    channels.forEach(function (value, i) {
        channels[i] = 0;
    });
};

function calculateFixtures(hasActive) {
    for (fixture in fixtures) {
        for (channel in fixture.channels) {
            if (hasActive == true) {
                if (channel.active == true) {
                    channels[fixture.startDMXAddress + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
                }
            } else {
                channels[fixture.startDMXAddress + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
            }
        }
    }
};

function getFixtureValues() {
    var values = new Array(512).fill(0);
    for (fixture in fixtures) {
        for (channel in fixture.channels) {
            values[fixture.startDMXAddress + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
        }
    }
    return values;
};

function calculateCue(cue) {
    var outputChannels = new Array(512).fill(0);
    var startChannels = getFixtureValues();
    startChannels.forEach(function (value, i) {
        var startChannel = startChannels[i];
        var endChannel = cue.channels[i];
        outputChannels[i] = startChannel + (((endChannel - startChannel) / (cue.time * 40)) * cue.step);
    });
    return outputChannels;
}

function calculateStack() {
    for (var s in stack) {
        if (s.type == "cue") {
            channels = calculateCue(s);
            s.step -= 1;
            if (s.step <= 0) {
                stack.splice(stack[stack.map(el => el.id).indexOf(s.id)], 1);
            }
        }
    }
};

function resetFixtures() {
    var newFixtures = JSON.parse(JSON.stringify(fixtures));
    for (var f in newFixtures) {
        for (var c in newFixtures[f].channels) {
            newFixtures[f].channels[c].value = newFixtures[f].channels[c].default;
        }
    }
    return newFixtures;
};

function dmxLoop() {
    resetDMXValues();
    calculateFixtures(false);
    calculateStack();
    calculateFixtures(true);
    if (OUTPUT == 1) {
        channels.forEach(function (value, i) {
            dmx.set(i+1, value);
        });
    } else {
        slotsData = channels;
        client.send(packet);
    }
    //console.log("frame");
};

console.log("Tonalite v2.0 - Wireless Lighting Control");
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.min.html');
});
http.listen(3000, function () {
    console.log('Tonalite listening on *:3000');
});
setInterval(dmxLoop, 250);

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.emit('fixtures', fixtures);

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
        socket.emit('fixtures', fixtures);
    });

    socket.on('removeFixture', function (msg) {
        fixtures.splice(fixtures[fixtures.map(el => el.id).indexOf(msg.id)], 1);
    });

    socket.on('getFixtureSettings', function (msg) {
        socket.emit('fixtureSettings', fixtures[fixtures.map(el => el.id).indexOf(msg.id)]);
    });

    socket.on('editFixtureSettings', function (msg) {
        var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
        fixture.name = msg.name;
        fixture.shortName = msg.shortName;
        fixture.manfacturer = msg.manufacturer;
        fixture.startDMXAddress = msg.startDMXAddress;
        socket.emit('fixtureSettings', fixture);
        socket.emit('message', { type: "info", content: "Fixture settings have been updated!" });
    });

    socket.on('getFixtureChannels', function (msg) {
        socket.emit('fixtureChannels', fixtures[fixtures.map(el => el.id).indexOf(msg.id)].channels);
    });

    socket.on('resetFixtures', function () {
        resetFixtures();
        socket.emit('fixtures', fixtures);
        socket.emit('message', { type: "info", content: "Fixture settings have been reset!" });
    });

    socket.on('changeFixtureChannelValue', function (msg) {
        var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
        var channel = fixture.channels[fixture.channels.map(el => el.id).indexOf(msg.cid)];
        channel.value = msg.value;
        socket.emit('fixtureChannels', fixture.channels);
    });

    socket.on('recordCue', function () {
        var newCue = {
            id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            type: "cue",
            time: 3,
            step: (3 * 40) + 1,
            channels: getFixtureValues()
        };
        cues.push(newCue);
        socket.emit('cues', cues);
    });

    socket.on('updateCue', function (msg) {
        var cue = cues[cues.map(el => el.id).indexOf(msg.id)];
        cue.channels = getFixtureValues();
        socket.emit('cueSettings', cue);
        socket.emit('message', { type: "info", content: "Cue channel values have been updated!" });
    });

    socket.on('getCueSettings', function (msg) {
        socket.emit('cueSettings', cues[cues.map(el => el.id).indexOf(msg.id)]);
    });

    socket.on('editCueSettings', function (msg) {
        var cue = cues[cues.map(el => el.id).indexOf(msg.id)];
        cue.time = msg.time;
        cue.step = (msg.time * 40) + 1;
        socket.emit('cueSettings', cue);
        socket.emit('message', { type: "info", content: "Cue settings have been updated!" });
    });

    socket.on('removeCue', function (msg) {
        cues.splice(cues[cues.map(el => el.id).indexOf(msg.id)], 1);
        socket.emit('cues', cues);
    })
});