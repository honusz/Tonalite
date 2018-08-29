var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var e131 = require('e131');
var uDMX = require('./udmx');
var fs = require('fs');

// 0 = e1.31, 1 = udmx
var OUTPUT = 0;

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

var fixtures = [];
var cues = [];
var stack = [];
var currentCue = -1;
var lastCue = -1;

function mapRange(num, inMin, inMax, outMin, outMax) {
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function resetDMXValues() {
    channels.forEach(function (value, i) {
        channels[i] = 0;
    });
};

function calculateFixtures() {
    fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            channels[(fixture.startDMXAddress -1) + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
        });
    });
};

function getFixtureValues() {
    var values = new Array(512).fill(0);
    fixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            values[(fixture.startDMXAddress - 1) + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
        });
    });
    return values;
};

function calculateCue(cue) {
    var outputChannels = new Array(512).fill(0);

    cue.fixtures.forEach(function (fixture, i) {
        fixture.channels.forEach(function (channel, i) {
            var startFixture = fixtures[fixtures.map(el => el.id).indexOf(fixture.id)];
            var startChannel = mapRange(startFixture.channels[i].value, startFixture.channels[i].displayMin, startFixture.channels[i].displayMax, startFixture.channels[i].min, startFixture.channels[i].max);
            var endChannel = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
            outputChannels[(fixture.startDMXAddress - 1) + channel.dmxAddress] = endChannel + (((startChannel - endChannel) / (cue.time * 40)) * cue.step);
            startFixture.channels[i].value = channel.value;
        });
    });
    
    console.log(outputChannels[0]);
    return outputChannels;
}

function calculateStack() {
    if (currentCue != -1) {
        cue = cues[currentCue];
        channels = calculateCue(cue);
        //console.log(channels[0]);
        cue.step -= 1;
        if (cue.step == 0) {
            currentCue = -1;
            cue.step = (cue.time * 40) + 2;
            cue.active = false;
            io.sockets.emit('cues', cues);
            io.sockets.emit('cueActionBtn', false);
        }
    }
    //stack.forEach(function (item) {
    // Calculate stack
    //});
};

function resetFixtures() {
    var newFixtures = JSON.parse(JSON.stringify(fixtures));
    newFixtures.forEach(function (fixture) {
        fixture.channels.forEach(function (channel) {
            channel.value = channel.default;
        });
    });
    return newFixtures;
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

console.log("Tonalite v2.0 - Wireless Lighting Control");
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
http.listen(3000, function () {
    console.log('Tonalite listening on *:3000');
});
setInterval(dmxLoop, 25);

io.on('connection', function (socket) {
    //console.log('a user connected');
    socket.emit('fixtures', fixtures);
    socket.emit('cues', cues);
    socket.emit('cueActionBtn', false);

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

    socket.on('removeFixture', function (msg) {
        fixtures.splice(fixtures[fixtures.map(el => el.id).indexOf(msg.id)], 1);
        socket.emit('message', { type: "info", content: "Fixture has been removed!" });
        io.emit('fixtures', fixtures);
    });

    socket.on('getFixtureSettings', function (msg) {
        socket.emit('fixtureSettings', fixtures[fixtures.map(el => el.id).indexOf(msg.id)]);
    });

    socket.on('editFixtureSettings', function (msg) {
        var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
        fixture.name = msg.name;
        fixture.shortName = msg.shortName;
        //fixture.manfacturer = msg.manufacturer;
        fixture.startDMXAddress = msg.startDMXAddress;
        socket.emit('fixtureSettings', fixture);
        socket.emit('message', { type: "info", content: "Fixture settings have been updated!" });
        io.emit('fixtures', fixtures);
    });

    socket.on('getFixtureChannels', function (msg) {
        var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
        socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
    });

    socket.on('resetFixtures', function () {
        resetFixtures();
        io.emit('fixtures', fixtures);
        socket.emit('message', { type: "info", content: "Fixture settings have been reset!" });
    });

    socket.on('changeFixtureChannelValue', function (msg) {
        var fixture = fixtures[fixtures.map(el => el.id).indexOf(msg.id)];
        var channel = fixture.channels[msg.cid];
        channel.value = msg.value;
        //socket.emit('fixtureChannels', { id: fixture.id, name: fixture.name, channels: fixture.channels });
        socket.broadcast.emit('fixtures', fixtures);
    });

    socket.on('recordCue', function () {
        var newCue = {
            id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            type: "cue",
            name: "Cue " + (cues.length + 1),
            time: 3,
            step: (3 * 40) + 2, // 3 * (40) + 2
            active: false,
            channels: getFixtureValues()
        };
        cues.push(newCue);
        io.emit('cues', cues);
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
        cue.name = msg.name;
        cue.time = msg.time;
        cue.step = (msg.time * 40) + 2;
        socket.emit('cueSettings', cue);
        socket.emit('message', { type: "info", content: "Cue settings have been updated!" });
        io.emit('cues', cues);
    });

    socket.on('removeCue', function (msg) {
        cues.splice(cues[cues.map(el => el.id).indexOf(msg.id)], 1);
        if (currentCue == cues.map(el => el.id).indexOf(msg.id)) {
            lastCue = -1;
            currentCue = lastCue;
            io.emit('cueActionBtn', false);
        }
        socket.emit('message', { type: "info", content: "Cue has been removed!" });
        io.emit('cues', cues);
    });

    socket.on('nextCue', function () {
        if (lastCue != -1) {
            cues[lastCue].step = (cues[lastCue].time * 40) + 2;
            cues[lastCue].active = false;
            if (lastCue == cues.length - 1) {
                lastCue = 0;
            } else {
                lastCue = lastCue + 1;
            }
        } else {
            lastCue = 0;
        }
        currentCue = lastCue;
        cues[lastCue].active = true;
        io.emit('cues', cues);
        io.emit('cueActionBtn', true);
    });

    socket.on('lastCue', function () {
        if (lastCue != -1) {
            cues[lastCue].step = (cues[lastCue].time * 40) + 2;
            cues[lastCue].active = false;
            if (lastCue == 0) {
                lastCue = cues.length - 1;
            } else {
                lastCue = lastCue - 1;
            }
        } else {
            lastCue = cues.length - 1;
        }
        currentCue = lastCue;
        cues[lastCue].active = true;
        io.emit('cues', cues);
        io.emit('cueActionBtn', true);
    });

    socket.on('stopCue', function () {
        currentCue = -1;
        cues[lastCue].step = (cues[lastCue].time * 40) + 2;
        cues[lastCue].active = false;
        io.emit('cues', cues);
        io.emit('cueActionBtn', false);
    });

    socket.on('gotoCue', function (cueID) {
        if (lastCue != -1) {
            cues[lastCue].step = (cues[lastCue].time * 40) + 2;
            cues[lastCue].active = false;
        }
        lastCue = cues.map(el => el.id).indexOf(cueID);
        currentCue = lastCue;
        cues[lastCue].active = true;
        io.emit('cues', cues);
        io.emit('cueActionBtn', true);
    });
});
