var socket = io('http://' + document.domain + ':' + location.port);

var app = new Vue({
    el: '#app',
    data: {
        presets: []
    },
    methods: {
        changePresetActive: function (presetID) {
            socket.emit('changePresetActive', presetID);
        }
    }
});

socket.on('presets', function (presets) {
    app.presets = presets;
});
