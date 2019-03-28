var socket = io('http://' + document.domain + ':' + location.port);

var app = new Vue({
    el: '#app',
    data: {
        presets: [],
        grandmaster: 0.0,
        desktop: false
    },
    methods: {
        changePresetActive: function (presetID) {
            socket.emit('changePresetActive', presetID);
        },
        updateGrandmasterValue: function () {
            socket.emit('changeGrandmasterValue', app.grandmaster);
        },
    }
});

socket.on('connect', function () {
    $('#serverDisconnectedModal').modal("hide");
});

socket.on('connect_error', function () {
    $('#serverDisconnectedModal').modal("show");
});

socket.on('meta', function (metadata) {
    app.desktop = metadata.desktop;
});

socket.on('grandmaster', function (value) {
    app.grandmaster = value;
});

socket.on('presets', function (presets) {
    app.presets = presets;
});

function resetFixtures() {
    bootbox.confirm("Are you sure you want to reset all fixture channel values?", function (result) {
        if (result === true) {
            socket.emit('resetFixtures');
        }
    });
};
