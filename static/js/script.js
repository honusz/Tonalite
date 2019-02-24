var socket = io('http://' + document.domain + ':' + location.port);
var fixturesList = document.getElementById('fixturesList');
var groupFixtureIDs = document.getElementById('groupFixtureIDs');
var timerID;
var counter = 0;
document.getElementById("fixturesTab").click();

var app = new Vue({
    el: '#app',
    data: {
        fixtures: [],
        groups: [],
        presets: [],
        cues: [],
        showFiles: [],
        fixtureProfiles: [],
        usbPath: "",
        desktop: false,
        version: "2.0.0 Beta 3",
        qrcode: "",
        currentCue: "",
        blackout: false,
        startDMXAddress: 1,
        newFixtureCreationCount: 1,
        currentTab: "fixtures",
        cueActionBtn: false,
        grandmaster: 0.0,
        fixtureChannels: { id: "", name: "", channels: [], chips: [] }
    },
    computed: {
        fixtures: function () {
            $('#groupFixtureIDs').multiselect('rebuild');
        }
    },
    methods: {
        changePresetActive: function (presetID) {
            socket.emit('changePresetActive', presetID);
        },
        viewPresetSettings: function (presetID) {
            socket.emit('getPresetSettings', presetID);
        },
        viewFixtureChannels: function (fixtureID) {
            socket.emit('getFixtureChannels', fixtureID);
        },
        viewGroupChannels: function (groupID) {
            socket.emit('getGroupChannels', groupID);
        },
        viewCueSettings: function (cueID) {
            socket.emit('getCueSettings', cueID);
        },
        lockedFixturechannels: function (locked) {
            if (locked === true)
                return "<i class=\"ml-1 far fa-lock-alt fa-sm\"></i>";
            return "";
        },
        openShowFromUSB: function (showFile) {
            socket.emit('openShowFromUSB', [showFile, app.usbPath]);
            $('#showFilesModal').modal("hide");
        },
        ifMobile: function () {
            return isMobile.any;
        },
        addFixture: function (fixture) {
            socket.emit('addFixture', { fixtureName: fixture, startDMXAddress: parseInt($('#newFixtureStartDMXAddress').val()), creationCount: parseInt($('#newFixtureCreationCount').val()) });
            $('#fixtureProfilesModal').modal("hide");
        },
        upperCase: function (str) {
            return str.toUpperCase().replace(/-/g, " ");
        },
        titleCase: function (str) {
            return str.toLowerCase().split(' ').map(function (word) {
                return (word.charAt(0).toUpperCase() + word.slice(1));
            }).join(' ');
        },
        openTab: function (tabName) {
            app.currentTab = tabName;
            closeAlert();
        },
        recordCue: function () {
            socket.emit('recordCue');
        },
        nextCue: function () {
            socket.emit('nextCue');
        },
        lastCue: function () {
            socket.emit('lastCue');
        },
        stopCue: function () {
            socket.emit('stopCue');
        },
        updateGrandmasterValue: function () {
            socket.emit('changeGrandmasterValue', parseInt(app.grandmaster));
        },
        resetFixture: function () {
            bootbox.confirm("Are you sure you want to reset this fixture's channel values?", function (result) {
                if (result === true) {
                    socket.emit('resetFixture', app.fixtureChannels.id);
                }
            });
        },
        viewFixtureSettings: function () {
            socket.emit('getFixtureSettings', app.fixtureChannels.id);
        },
        updateFixtureChannelValue: function (channelID) {
            socket.emit('changeFixtureChannelValue', { id: app.fixtureChannels.id, cid: channelID, value: parseInt(app.fixtureChannels.channels[channelID].value) });
        },
        updateFixtureChannelLock: function (channelID) {
            socket.emit('changeFixtureChannelLock', { id: app.fixtureChannels.id, cid: channelID });
        },
        useFixtureChip: function (chipID) {
            socket.emit('useFixtureChip', { id: app.fixtureChannels.id, cid: chipID });
        }
    }
});

Mousetrap.bind('r', function () { app.recordCue(); });
Mousetrap.bind('right', function () { app.nextCue(); });
Mousetrap.bind('left', function () { app.lastCue(); });
Mousetrap.bind('ctrl+n', function () { resetShow(); return false; });
Mousetrap.bind('shift+a', function () { addFixtureModal(); return false; });
Mousetrap.bind('ctrl+s', function () { window.location = "/showFile"; return false; });

function launchFullScreen(element) {
    if (element.requestFullScreen) {
        element.requestFullScreen();
    } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullScreen) {
        element.webkitRequestFullScreen();
    } else if (element.msRequestFullScreen) {
        element.msRequestFullScreen();
    } else {
        element.webkitEnterFullScreen();
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
});

socket.on('blackout', function (msg) {
    app.blackout = msg;
});

socket.on('grandmaster', function (value) {
    app.grandmaster = value;
});

socket.on('currentCue', function (value) {
    app.currentCue = value;
});

socket.on('fixtures', function (fixtures) {
    app.fixtures = fixtures;
    $('#groupFixtureIDs').multiselect('rebuild');
});

socket.on('fixtureProfiles', function (profiles) {
    app.newFixtureCreationCount = 1;
    app.startDMXAddress = profiles[1];
    app.fixtureProfiles = profiles[0];
    $('#fixtureProfilesModal').modal("show");
});

socket.on('shows', function (shows) {
    app.showFiles = shows[0];
    app.usbPath = shows[1];
    $('#showFilesModal').modal("show");
});

socket.on('fixtureChannels', function (msg) {
    Vue.set(app.fixtureChannels, 'channels', msg.channels);
    Vue.set(app.fixtureChannels, 'name', msg.name);
    Vue.set(app.fixtureChannels, 'id', msg.id);
    Vue.set(app.fixtureChannels, 'chips', msg.chips);
    app.openTab('fixtureChannelsPage');
});

socket.on('fixtureSettings', function (fixture) {
    app.openTab('fixtureSettingsPage');
    $("#fixtureChannelsBackBtn").off().on("click", function () { app.viewFixtureChannels(); });
    $("#fixtureDeleteBtn").off().on("click", function () { removeFixture(fixture.id); });
    $("#fixtureSaveBtn").off().on("click", function () { saveFixtureSettings(fixture.id); });
    $("#fixtureNameInput").val(fixture.name);
    $("#fixtureShortNameInput").val(fixture.shortName);
    $("#fixtureDMXAddressInput").val(fixture.startDMXAddress);
});

socket.on('cues', function (cues) {
    app.cues = cues;
});

socket.on('presets', function (presets) {
    app.presets = presets;
});

socket.on('presetSettings', function (preset) {

    app.openTab('presetSettingsPage');
    $("#presetDeleteBtn").off().on("click", function () { removePreset(preset.id); });
    $("#presetSaveBtn").off().on("click", function () { savePresetSettings(preset.id); });
    $("#presetActiveBtn").off().on("click", function () { app.changePresetActive(preset.id); });
    $("#presetNameInput").val(preset.name);
    if (preset.active) {
        $("#presetActiveBtn").html("Deactivate");
    } else {
        $("#presetActiveBtn").html("Activate");
    }
});

socket.on('cueSettings', function (cue) {
    app.openTab('cueSettingsPage');
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
    app.cueActionBtn = btnMode;
});

socket.on('groups', function (groups) {
    app.groups = groups;
});

socket.on('groupSettings', function (group) {
    app.openTab('groupSettingsPage');
    $("#groupChannelsBackBtn").off().on("click", function () { app.viewGroupChannels(group.id); });
    $("#groupDeleteBtn").off().on("click", function () { removeGroup(group.id); });
    $("#groupSaveBtn").off().on("click", function () { saveGroupSettings(group.id); });
    $("#groupNameInput").val(group.name);
    $("#groupShortNameInput").val(group.shortName);
});

socket.on('groupChannels', function (msg) {
    app.openTab('groupChannelsPage');
    $("#groupChannels").empty();
    $("#groupChannelsName").text(msg.name);
    $("#groupSettingsBtn").off().on("click", function () { viewGroupSettings(msg.id); });
    $("#groupResetBtn").off().on("click", function () { resetGroup(msg.id); });
    msg.channels.forEach(function (channel, i) {
        $("#groupChannels").append("<label class=\"ml-2\" for=\"" + channel.type + "\">" + channel.name + ":</label><input type=\"range\" class=\"custom-range\" id=\"" + channel.type + "\" max=\"" + channel.displayMax + "\" min=\"" + channel.displayMin + "\" value=\"" + channel.value + "\" oninput=\"updateGroupChannelValue(this, '" + msg.id + "', " + i + ")\">");
    });
});

socket.on('settings', function (settings) {
    $("#defaultUpTime").val(settings.defaultUpTime);
    $("#defaultDownTime").val(settings.defaultDownTime);
    $("#useUDMX").prop('indeterminate', settings.udmx);
    $("#useAutomark").prop('indeterminate', settings.automark);
    $("#sacnIP").val(settings.sacnIP);
    $("#artnetIP").val(settings.artnetIP);
    $('#openSettingsModal').modal("show");
});

socket.on('meta', function (metadata) {
    app.desktop = metadata.desktop;
    app.version = metadata.version;
    app.qrcode = metadata.qrcode;
});

socket.on('connect', function () {
    $('#serverDisconnectedModal').modal("hide");
});

socket.on('connect_error', function () {
    $('#serverDisconnectedModal').modal("show");
});

function resetFixtures() {
    bootbox.confirm("Are you sure you want to reset all fixture channel values?", function (result) {
        if (result === true) {
            socket.emit('resetFixtures');
        }
    });
};

function addFixtureModal() {
    socket.emit('getFixtureProfiles');
}

function getShowModal() {
    socket.emit('getShowsFromUSB');
}

function openFixtureDefinitionModal() {
    $('#openFixtureDefinitionModal').modal("show");
}

function removeFixture(fixtureID) {
    bootbox.confirm("Are you sure you want to delete this fixture?", function (result) {
        if (result === true) {
            socket.emit('removeFixture', fixtureID);
            app.openTab('fixtures');
        }
    });
}

function saveFixtureSettings(fixtureID) {
    socket.emit('editFixtureSettings', { id: fixtureID, name: $("#fixtureNameInput").val(), shortName: $("#fixtureShortNameInput").val(), startDMXAddress: $("#fixtureDMXAddressInput").val() });
}

function removeCue(cueID) {
    bootbox.confirm("Are you sure you want to delete this cue?", function (result) {
        if (result === true) {
            socket.emit('removeCue', cueID);
            app.openTab('cues');
        }
    });
}

function saveCueSettings(cueID) {
    socket.emit('editCueSettings', { id: cueID, name: $("#cueNameInput").val(), upTime: $("#cueUpTimeInput").val(), downTime: $("#cueDownTimeInput").val(), follow: $("#cueFollowInput").val() });
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

function moveCueUp(cueID) {
    socket.emit('moveCueUp', cueID);
}

function moveCueDown(cueID) {
    socket.emit('moveCueDown', cueID);
}

function removePreset(presetID) {
    bootbox.confirm("Are you sure you want to delete this preset?", function (result) {
        if (result === true) {
            socket.emit('removePreset', presetID);
            app.openTab('presets');
        }
    });
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

function resetGroup(groupID) {
    bootbox.confirm("Are you sure you want to reset this group's channel values?", function (result) {
        if (result === true) {
            socket.emit('resetGroup', groupID);
        }
    });
};

function resetGroups() {
    bootbox.confirm("Are you sure you want to reset all group channel values?", function (result) {
        if (result === true) {
            socket.emit('resetGroups');
        }
    });
};

function addGroupModal() {
    $('#addGroupModal').modal("show");
}

function updateGroupChannelValue(self, groupID, channelID) {
    socket.emit('changeGroupChannelValue', { id: groupID, cid: channelID, value: parseInt(self.value) });
}

function removeGroup(groupID) {
    bootbox.confirm("Are you sure you want to delete this group?", function (result) {
        if (result === true) {
            socket.emit('removeGroup', groupID);
            app.openTab('groups');
        }
    });
}

function saveGroupSettings(groupID) {
    socket.emit('editGroupSettings', { id: groupID, name: $("#groupNameInput").val(), shortName: $("#groupShortNameInput").val(), fixtureIDs: $("#groupFixtureIDsInput").val() });
}

function addGroup() {
    socket.emit('addGroup', $("#groupFixtureIDs").val());
    document.getElementById("groupFixtureIDs").selectedIndex = "-1";
    $('#addGroupModal').modal("hide");
}

function viewGroupSettings(groupID) {
    socket.emit('getGroupSettings', groupID);
}

function toggleBlackout() {
    socket.emit('toggleBlackout');
}

function openShowFileModal() {
    $('#openShowModal').modal("show");
}

function openAboutModal() {
    $('#openAboutModal').modal("show");
}

function openSettingsModal() {
    socket.emit('getSettings');
    $('#openSettingsModal').modal("show");
}

function resetShow() {
    bootbox.confirm("Are you sure you want a new show? This will reset everything.", function (result) {
        if (result === true) {
            socket.emit('resetShow');
            app.openTab('fixtures');
        }
    });
}

function closeSettings() {
    socket.emit('closeSettings');
    $('#openSettingsModal').modal("hide");
}

function saveSettingsBackground() {
    socket.emit('saveSettings', { defaultUpTime: $("#defaultUpTime").val(), defaultDownTime: $("#defaultDownTime").val(), udmx: $("#useUDMX").prop('checked'), automark: $("#useAutomark").prop('checked'), sacnIP: $("#sacnIP").val(), artnetIP: $("#artnetIP").val() });
}

function updateFirmware() {
    socket.emit('updateFirmware');
}

function saveShowToUSB() {
    bootbox.prompt("Show Name: ", function (result) {
        if (result.trim() != "") {
            socket.emit('saveShowToUSB', result);
        } else {
            bootbox.alert("You must enter a show name!");
        }
    });
}

function shutdown() {
    socket.emit('shutdown');
}

function reboot() {
    socket.emit('reboot');
}

function closeAlert() {
    $("#alert").removeClass("show");
    if ($("#alert").hasClass("alert-info")) {
        $("#alert").removeClass("alert-info")
    } else {
        $("#alert").removeClass("alert-danger")
    }
}

function openTabOld(tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    if (document.getElementsByClassName("tabitem-" + tabName)[0]) {
        // Get all elements with class="tablinks" and remove the class "active"
        tablinks = document.getElementsByClassName("tabitem");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove("active");
        }
    }

    if (document.getElementsByClassName("tabitem-" + tabName)[0]) {
        document.getElementsByClassName("tabitem-" + tabName)[0].classList.add("active");
    }

    closeAlert();
}

function searchFixtureProfiles() {
    var input, filter, ul, li, a, i, txtValue;
    input = document.getElementById('searchFixtureProfiles');
    filter = input.value.toUpperCase();
    ul = document.getElementById("fixtureProfilesList");
    li = ul.getElementsByTagName('li');

    // Loop through all list items, and hide those who don't match the search query
    for (i = 0; i < li.length; i++) {
        a = li[i];
        txtValue = a.textContent || a.innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

$('.custom-file-input').change(function () {
    var fileName = $(this).val().split('\\').pop();
    $(this).next('.custom-file-label').html(fileName);
});

Vue.nextTick(function () {
    $('#groupFixtureIDs').multiselect('rebuild');
})
