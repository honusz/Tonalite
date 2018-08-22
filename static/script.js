var socket = io('http://' + document.domain + ':' + location.port);

socket.on('fixtures', function (fixtures) {
    console.log(fixtures);
});

socket.on('message', function (msg) {
    console.log(msg.type+': '+msg.content);
});

function resetFixtures() {
    socket.emit('resetFixtures');
};

function addFixtureModal() {
    socket.emit('getFixtureProfiles');
    $('#fixtureProfileModal').modal();
}