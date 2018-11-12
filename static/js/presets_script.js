var socket = io('http://' + document.domain + ':' + location.port);

socket.on('presets', function (presets) {
    $("#presetsList").empty();
    //console.log(presets);
    if (presets.length != 0) {
        var p = 0; const pMax = presets.length; for (; p < pMax; p++) {
            if (presets[p].active == true) {
                style = "style=\"background-color:#f59f00\"";
            } else {
                style = "";
            }
            $("#presetsList").append("<div class=\"col-4 col-lg-2\"><div class=\"presetItem\" " + style + "onclick=\"changePresetActive('" + presets[p].id + "')\"><p>" + presets[p].name + "</p></div></div>");
        }
    } else {
        $("#presetsList").append("<div class=\"col-12\"><h5>There are no presets in this show!</h5></div>");
    }
});

function changePresetActive(presetID) {
    socket.emit('changePresetActive', presetID);
}
