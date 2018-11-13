var socket = io('http://' + document.domain + ':' + location.port);
var fixturesList = document.getElementById('fixturesList');
var groupFixtureIDs = document.getElementById('groupFixtureIDs');
var currentTab = "fixtures";
var backupFixtures = [];
var lastActiveCue = "";
document.getElementById("fixturesTab").click();

function launchFullScreen(element) {
    if (element.requestFullScreen) {
        element.requestFullScreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullScreen) {
        element.webkitRequestFullScreen();
    }
}

socket.on('message', function (msg) {
    $("#alertText").text(msg.content);
    $("#alert").addClass("show");
    $("#alert").fadeTo(1000, 500).slideUp(500, function () {
        $("#alert").removeClass('show');
    });
    if (msg.type == "info") {
        $("#alert").addClass("alert-info");
    } else {
        $("#alert").addClass("alert-danger");
    }
    //console.log(msg.type + ': ' + msg.content);
});

socket.on('fixtures', function (fixtures) {
    //console.log(fixtures);
    if (currentTab == "fixtures") {
        setFixtures(fixtures);
        backupFixtures = fixtures;
    } else {
        backupFixtures = fixtures;
    }
});

socket.on('fixtureProfiles', function (profiles) {
    $("#fixtureProfilesList").empty();
    var p = 0; const pMax = profiles[0].length; for (; p < pMax; p++) {
        $("#fixtureProfilesList").append("<li class=\"list-group-item fixtureProfileItem\" onclick=\"addFixture('" + profiles[0][p] + "')\">" + upperCase(profiles[0][p]) + "</li>");
    }
    $("#newFixtureStartDMXAddress").val(profiles[1]);
    $("#newFixtureCreationCount").val(1);
});

socket.on('fixtureChannels', function (msg) {
    openTab('fixtureChannelsPage');
    $("#fixtureChannels").empty();
    $("#fixtureChannelsName").text(msg.name);
    $("#fixtureSettingsBtn").off().on("click", function () { viewFixtureSettings(msg.id); });
    $("#fixtureResetBtn").off().on("click", function () { resetFixture(msg.id); });
    var c = 0; const cMax = msg.channels.length; for (; c < cMax; c++) {
        if (msg.channels[c].locked) {
            $("#fixtureChannels").append("<button class=\"btn btn-info\" onclick=\"updateFixtureChannelLock(this, '" + msg.id + "', " + c + ")\"><i class=\"far fa-lock-alt fa-sm\"></i></button><label class=\"ml-2\" for=\"" + msg.channels[c].type + "\">" + msg.channels[c].name + ":</label><input type=\"range\" class=\"custom-range\" id=\"" + msg.channels[c].type + "\" max=\"" + msg.channels[c].displayMax + "\" min=\"" + msg.channels[c].displayMin + "\" value=\"" + msg.channels[c].value + "\" oninput=\"updateFixtureChannelValue(this, '" + msg.id + "', " + c + ")\">");
        } else {
            $("#fixtureChannels").append("<button class=\"btn btn-info\" onclick=\"updateFixtureChannelLock(this, '" + msg.id + "', " + c + ")\"><i class=\"far fa-lock-open-alt fa-sm \"></i></button><label class=\"ml-2\" for=\"" + msg.channels[c].type + "\">" + msg.channels[c].name + ":</label><input type=\"range\" class=\"custom-range\" id=\"" + msg.channels[c].type + "\" max=\"" + msg.channels[c].displayMax + "\" min=\"" + msg.channels[c].displayMin + "\" value=\"" + msg.channels[c].value + "\" oninput=\"updateFixtureChannelValue(this, '" + msg.id + "', " + c + ")\">");
        }
    }
});

socket.on('fixtureSettings', function (fixture) {
    openTab('fixtureSettingsPage');
    $("#fixtureChannelsBackBtn").off().on("click", function () { viewFixtureChannels(fixture.id); });
    $("#fixtureDeleteBtn").off().on("click", function () { removeFixture(fixture.id); });
    $("#fixtureSaveBtn").off().on("click", function () { saveFixtureSettings(fixture.id); });
    $("#fixtureNameInput").val(fixture.name);
    $("#fixtureShortNameInput").val(fixture.shortName);
    $("#fixtureDMXAddressInput").val(fixture.startDMXAddress);
});

socket.on('cues', function (cues) {
    $("#cuesList").empty();
    //console.log(cues);
    if (cues.length != 0) {
        var c = 0; const cMax = cues.length; for (; c < cMax; c++) {
            if (cues[c].active == true) {
                style = "style=\"background-color:#f59f00\"";
                lastActiveCue = cues[c].id;
            } else {
                if (cues[c].id == lastActiveCue) {
                    style = "style=\"background-color:#0c8599\"";
                } else {
                    style = "";
                }
            }
            $("#cuesList").append("<div class=\"col-4 col-lg-2\"><div class=\"cueItem\" " + style + "onclick=\"viewCueSettings('" + cues[c].id + "')\"><p>" + cues[c].name + "</p></div></div>");
        }
    } else {
        $("#cuesList").append("<div class=\"col-12\"><h5>There are no cues in this show!</h5></div>");
    }
});

socket.on('presets', function (presets) {
    $("#presetsList").empty();
    //console.log(presets);
    if (presets.length != 0) {
        var p = 0; const pMax = presets.length; for (; p < pMax; p++) {
            if (presets[p].active == true) {
                style = "style=\"background-color:#fa5252\"";
            } else {
                style = "";
            }
            $("#presetsList").append("<div class=\"col-4 col-lg-2\"><div class=\"presetItem\" " + style + "onclick=\"viewPresetSettings('" + presets[p].id + "')\"><p>" + presets[p].name + "</p></div></div>");
        }
    } else {
        $("#presetsList").append("<div class=\"col-12\"><h5>There are no presets in this show!</h5></div>");
    }
});

socket.on('presetSettings', function (preset) {
    openTab('presetSettingsPage');
    $("#presetDeleteBtn").off().on("click", function () { removePreset(preset.id); });
    $("#presetSaveBtn").off().on("click", function () { savePresetSettings(preset.id); });
    $("#presetActiveBtn").off().on("click", function () { changePresetActive(preset.id); });
    $("#presetNameInput").val(preset.name);
    if (preset.active) {
        $("#presetActiveBtn").html("Deactivate");
    } else {
        $("#presetActiveBtn").html("Activate");
    }
});

socket.on('cueSettings', function (cue) {
    openTab('cueSettingsPage');
    $("#cueDeleteBtn").off().on("click", function () { removeCue(cue.id); });
    $("#cueSaveBtn").off().on("click", function () { saveCueSettings(cue.id); });
    $("#gotoCueBtn").off().on("click", function () { gotoCue(cue.id); });
    $("#cueUpdateBtn").off().on("click", function () { updateCue(cue.id); });
    $("#cueCloneBtn").off().on("click", function () { cloneCue(cue.id); });
    $("#moveCueUpBtn").off().on("click", function () { moveCueUp(cue.id); });
    $("#moveCueDownBtn").off().on("click", function () { moveCueDown(cue.id); });
    $("#cueNameInput").val(cue.name);
    $("#cueUpTimeInput").val(cue.upTime);
    $("#cueDownTimeInput").val(cue.downTime);
    $("#cueFollowInput").val(cue.follow);
});

socket.on('cueActionBtn', function (btnMode) {
    $("#cueActionBtn").empty();
    if (btnMode == false) {
        $("#cueActionBtn").off().on("click", function () { recordCue(); });
        $("#cueActionBtn").append("Record");
    } else {
        $("#cueActionBtn").off().on("click", function () { stopCue(); });
        $("#cueActionBtn").append("Stop");
    }
});

socket.on('groups', function (groups) {
    $("#groupsList").empty();
    //console.log(groups);
    if (groups.length != 0) {
        groups.forEach(function (group) {
            $("#groupsList").append("<div class=\"col-4 col-lg-2\"><div class=\"groupItem\" onclick=\"viewGroupChannels('" + group.id + "')\"><p>" + group.shortName + "</p></div></div>");
        });
    } else {
        $("#groupsList").append("<div class=\"col-12\"><h5>There are no groups in this show!</h5></div>");
    }
});

socket.on('groupSettings', function (group) {
    openTab('groupSettingsPage');
    $("#groupChannelsBackBtn").off().on("click", function () { viewGroupChannels(group.id); });
    $("#groupDeleteBtn").off().on("click", function () { removeGroup(group.id); });
    $("#groupSaveBtn").off().on("click", function () { saveGroupSettings(group.id); });
    $("#groupNameInput").val(group.name);
    $("#groupShortNameInput").val(group.shortName);
});

socket.on('groupChannels', function (msg) {
    openTab('groupChannelsPage');
    $("#groupChannels").empty();
    $("#groupChannelsName").text(msg.name);
    $("#groupSettingsBtn").off().on("click", function () { viewGroupSettings(msg.id); });
    $("#groupResetBtn").off().on("click", function () { resetGroup(msg.id); });
    msg.channels.forEach(function (channel, i) {
        $("#groupChannels").append("<label class=\"ml-2\" for=\"" + channel.type + "\">" + channel.name + ":</label><input type=\"range\" class=\"custom-range\" id=\"" + channel.type + "\" max=\"" + channel.displayMax + "\" min=\"" + channel.displayMin + "\" value=\"" + channel.value + "\" oninput=\"updateGroupChannelValue(this, '" + msg.id + "', " + i + ")\">");
    });
});

socket.on('settings', function (settings) {
    $("#serverURL").val(settings.url);
    $("#serverPort").val(settings.port);
    $("#defaultUpTime").val(settings.defaultUpTime);
    $("#defaultDownTime").val(settings.defaultDownTime);
    $('#openSettingsModal').modal("show");
});

function resetFixtures() {
    if (confirm("Are you sure you want to reset all fixture channel values?")) {
        socket.emit('resetFixtures');
    }
};

function resetFixture(fixtureID) {
    if (confirm("Are you sure you want to reset this fixture's channel values?")) {
        socket.emit('resetFixture', fixtureID);
    }
};

function addFixtureModal() {
    socket.emit('getFixtureProfiles');
    $('#fixtureProfilesModal').modal("show");
}

function openFixtureDefinitionModal() {
    $('#openFixtureDefinitionModal').modal("show");
}

function addFixture(fixture) {
    socket.emit('addFixture', { fixtureName: fixture, startDMXAddress: parseInt($('#newFixtureStartDMXAddress').val()), creationCount: parseInt($('#newFixtureCreationCount').val()) });
    $('#fixtureProfilesModal').modal("hide");
}

function viewFixtureChannels(fixtureID) {
    socket.emit('getFixtureChannels', fixtureID);
}

function viewFixtureSettings(fixtureID) {
    socket.emit('getFixtureSettings', fixtureID);
}

function updateFixtureChannelValue(self, fixtureID, channelID) {
    socket.emit('changeFixtureChannelValue', { id: fixtureID, cid: channelID, value: parseInt(self.value) });
}

function updateFixtureChannelLock(self, fixtureID, channelID) {
    socket.emit('changeFixtureChannelLock', { id: fixtureID, cid: channelID });
}

function removeFixture(fixtureID) {
    if (confirm("Are you sure you want to delete this fixture?")) {
        socket.emit('removeFixture', fixtureID);
        openTab('fixtures');
    }
}

function saveFixtureSettings(fixtureID) {
    socket.emit('editFixtureSettings', { id: fixtureID, name: $("#fixtureNameInput").val(), shortName: $("#fixtureShortNameInput").val(), startDMXAddress: $("#fixtureDMXAddressInput").val() });
}

function removeCue(cueID) {
    if (confirm("Are you sure you want to delete this cue?")) {
        socket.emit('removeCue', cueID);
        openTab('cues');
    }
}

function saveCueSettings(cueID) {
    socket.emit('editCueSettings', { id: cueID, name: $("#cueNameInput").val(), upTime: $("#cueUpTimeInput").val(), downTime: $("#cueDownTimeInput").val(), follow: $("#cueFollowInput").val() });
}

function recordCue() {
    socket.emit('recordCue');
}

function nextCue() {
    socket.emit('nextCue');
}

function lastCue() {
    socket.emit('lastCue');
}

function stopCue() {
    socket.emit('stopCue');
}

function gotoCue(cueID) {
    socket.emit('gotoCue', cueID);
}

function updateCue(cueID) {
    socket.emit('updateCue', cueID);
}

function cloneCue(cueID) {
    socket.emit('cloneCue', cueID);
}

function viewCueSettings(cueID) {
    socket.emit('getCueSettings', cueID);
}

function moveCueUp(cueID) {
    socket.emit('moveCueUp', cueID);
}

function moveCueDown(cueID) {
    socket.emit('moveCueDown', cueID);
}

function removePreset(presetID) {
    if (confirm("Are you sure you want to delete this preset?")) {
        socket.emit('removePreset', presetID);
        openTab('presets');
    }
}

function viewPresetSettings(presetID) {
    socket.emit('getPresetSettings', presetID);
}

function savePresetSettings(presetID) {
    socket.emit('editPresetSettings', { id: presetID, name: $("#presetNameInput").val() });
}

function recordPreset() {
    socket.emit('recordPreset');
}

function changePresetActive(presetID) {
    socket.emit('changePresetActive', presetID);
}

function resetGroup(groupID) {
    if (confirm("Are you sure you want to reset this group's channel values?")) {
        socket.emit('resetGroup', groupID);
    }
};

function resetGroups() {
    if (confirm("Are you sure you want to reset all group channel values?")) {
        socket.emit('resetGroups');
    }
};

function addGroupModal() {
    $('#addGroupModal').modal("show");
}

function viewGroupChannels(groupID) {
    socket.emit('getGroupChannels', groupID);
}

function updateGroupChannelValue(self, groupID, channelID) {
    socket.emit('changeGroupChannelValue', { id: groupID, cid: channelID, value: parseInt(self.value) });
}

function removeGroup(groupID) {
    if (confirm("Are you sure you want to delete this group?")) {
        socket.emit('removeGroup', groupID);
        openTab('groups');
    }
}

function saveGroupSettings(groupID) {
    socket.emit('editGroupSettings', { id: groupID, name: $("#groupNameInput").val(), shortName: $("#groupShortNameInput").val(), fixtureIDs: $("#groupFixtureIDsInput").val() });
}

function addGroup() {
    socket.emit('addGroup', $("#groupFixtureIDs").val());
    $('#addGroupModal').modal("hide");
}

function viewGroupSettings(groupID) {
    socket.emit('getGroupSettings', groupID);
}

function openShowFileModal() {
    $('#openShowModal').modal("show");
}

function openSettingsModal() {
    socket.emit('getSettings');
    $('#openSettingsModal').modal("show");
}

function resetShow() {
    if (confirm("Are you sure you want a new show? This will reset everything.")) {
        socket.emit('resetShow');
        openTab('fixtures');
    }
}

function saveSettings() {
    socket.emit('saveSettings', { url: $("#serverURL").val(), port: $("#serverPort").val(), defaultUpTime: $("#defaultUpTime").val(), defaultDownTime: $("#defaultDownTime").val() });
    $('#openSettingsModal').modal("hide");
}

function updateFirmware() {
    socket.emit('updateFirmware');
}

function closeAlert() {
    $("#alert").removeClass("show");
    if ($("#alert").hasClass("alert-info")) {
        $("#alert").removeClass("alert-info")
    } else {
        $("#alert").removeClass("alert-danger")
    }
}

function openTab(tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    if (document.getElementsByClassName("tablinks-" + tabName)[0]) {
        // Get all elements with class="tablinks" and remove the class "active"
        tablinks = document.getElementsByClassName("tablinks");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove("active");
        }
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    currentTab = tabName;
    if (currentTab == "fixtures") {
        setFixtures(backupFixtures);
    }
    if (document.getElementsByClassName("tablinks-" + tabName)[0]) {
        document.getElementsByClassName("tablinks-" + tabName)[0].classList.add("active");
    }
    closeAlert();
}

function titleCase(str) {
    return str.toLowerCase().split(' ').map(function (word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}

function upperCase(str) {
    return str.toUpperCase().replace(/-/g, " ");
}

function setFixtures(fixtures) {
    fixturesList.innerHTML = "";
    groupFixtureIDs.innerHTML = "";
    if (fixtures.length != 0) {
        var f = 0; const fMax = fixtures.length; for (; f < fMax; f++) {
            if (fixtures[f].hasLockedChannels) {
                fixtureLock = "<i class=\"ml-2 far fa-lock-alt fa-sm\"></i>";
            } else {
                fixtureLock = "";
            }
            if (fixtures[f].channels[0].type == "intensity") {
                fixtureValue = "<h3 class=\"fixtureValue\">" + fixtures[f].channels[0].displayValue + "</h3>";
            } else {
                if (fixtureLock == "") {
                    fixtureValue = "<h3 class=\"fixtureValue\"><i class=\"ml-2 far fa-lock-open-alt fa-sm\"></i></h3>";
                } else {
                    fixtureValue = "<h3 class=\"fixtureValue\">" + fixtureLock + "</h3>";
                }
            }
            var e = document.createElement('div');
            e.className = "col-4 col-lg-2";
            e.innerHTML = "<div class=\"fixtureItem\" onclick=\"viewFixtureChannels('" + fixtures[f].id + "')\">" + fixtureValue + "<p>" + fixtures[f].shortName + fixtureLock + "</p></div>";
            fixturesList.appendChild(e);
            var fi = document.createElement('option');
            fi.value = fixtures[f].id;
            fi.innerHTML = fixtures[f].shortName + " (" + fixtures[f].startDMXAddress + ")";
            groupFixtureIDs.appendChild(fi);
        }
    } else {
        $("#fixturesList").append("<div class=\"col-12\"><h5>There are no fixtures in this show!</h5></div>")
    }
}

$('.custom-file-input').change(function () {
    var fileName = $(this).val().split('\\').pop();
    $(this).next('.custom-file-label').html(fileName);
});
