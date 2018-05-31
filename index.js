var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var e131 = require('e131');

var client = new e131.Client(1);
var packet = client.createPacket(512);
var slotsData = packet.getSlotsData();

var fixtures = [];
var cues = [];
var effects = [];

function mapRange(num, inMin, inMax, outMin, outMax) {
    return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function resetDMXValues() {
    for (var i = 0; i < slotsData.length; ++i) {
        slotsData[i] = 0;
    }
};

function calculateFixtures(hasActive) {
    for (fixture in fixtures) {
        for (channel in fixture.channels) {
            if (hasActive == true) {
                if (channel.active == true) {
                    slotsData[fixture.startDMXAddress + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
                }
            } else {
                slotsData[fixture.startDMXAddress + channel.dmxAddress] = mapRange(channel.value, channel.displayMin, channel.displayMax, channel.min, channel.max);
            }
        }
    }
};

function calculateEffects() {
    return 0;
};

function resetFixtures(fixtures) {
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
    calculateEffects();
    calculateFixtures(true);
    client.send(packet);
    console.log("frame");
};

setInterval(dmxLoop, 250);

io.on('connection', function (socket) {
    console.log('a user connected');
    socket.emit('fixtures', fixtures);

    socket.on('getFixtureProfiles', function (msg) {
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
        io.sockets.emit('fixtures', fixtures);
    });
});