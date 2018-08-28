var socket = io('http://' + document.domain + ':' + location.port);
document.getElementById("fixturesTab").click();

socket.on('message', function (msg) {
    console.log(msg.type + ': ' + msg.content);
});

socket.on('fixtures', function (fixtures) {
    $("#fixturesList").empty();
    //console.log(fixtures);
    if (fixtures.length != 0) {
        fixtures.forEach(function (fixture) {
            $("#fixturesList").append("<div class=\"col-4\"><div class=\"fixtureItem\" onclick=\"viewFixtureChannels('" + fixture.id + "')\"><p>" + fixture.shortName + "</p></div></div>");
        });
    } else {
        $("#fixturesList").append("<div class=\"col-12\"><h5>There are no fixtures in this show!</h5></div>")
    }
});

socket.on('cues', function (cues) {
    $("#cuesList").empty();
    console.log(cues);
    if (cues.length != 0) {
        cues.forEach(function (cue) {
            if (cue.active == true) {
                style = "style=\"background-color:#fab005\"";
            } else {
                style = "";
            }
            $("#cuesList").append("<div class=\"col-4\"><div class=\"cueItem\" " + style + "onclick=\"viewCueSettings('" + cue.id + "')\"><p>" + cue.name + "</p></div></div>");
        });
    } else {
        $("#cuesList").append("<div class=\"col-12\"><h5>There are no cues in this show!</h5></div>")
    }
});

socket.on('fixtureProfiles', function (profiles) {
    $("#fixtureProfilesList").empty();
    profiles.forEach(function (value) {
        $("#fixtureProfilesList").append("<li class=\"list-group-item fixtureProfileItem\" onclick=\"addFixture('" + value + "')\">" + titleCase(value) + "</li>");
    });
});

socket.on('fixtureChannels', function (msg) {
    $("#fixtureChannels").empty();
    $("#fixtureChannelsName").text(msg.name);
    $("#fixtureSettingsBtn").on("click", function () { viewFixtureSettings(msg.id); });
    msg.channels.forEach(function (channel, i) {
        $("#fixtureChannels").append("<label for=\"" + channel.type + "\">" + channel.name + ":</label><input type=\"range\" class=\"custom-range\" id=\"" + channel.type + "\" max=\"" + channel.displayMax + "\" min=\"" + channel.displayMin + "\" value=\"" + channel.value + "\" oninput=\"updateFixtureChannelValue(this, '" + msg.id + "', " + i + ")\">");
    });
});

socket.on('fixtureSettings', function (fixture) {
    $("#fixtureChannelsBackBtn").on("click", function () { viewFixtureChannels(fixture.id); });
    $("#fixtureDeleteBtn").on("click", function () { removeFixture(fixture.id); });
    $("#fixtureSaveBtn").on("click", function () { saveFixtureSettings(fixture.id); });
    $("#fixtureNameInput").val(fixture.name);
    $("#fixtureShortNameInput").val(fixture.shortName);
    $("#fixtureDMXAddressInput").val(fixture.startDMXAddress);
});

socket.on('cueSettings', function (cue) {
    $("#cueDeleteBtn").on("click", function () { removeCue(cue.id); });
    $("#cueSaveBtn").on("click", function () { saveCueSettings(cue.id); });
    $("#cueNameInput").val(cue.name);
    $("#cueTimeInput").val(cue.time);
});

function resetFixtures() {
    socket.emit('resetFixtures');
};

function addFixtureModal() {
    socket.emit('getFixtureProfiles');
    $('#fixtureProfilesModal').modal("show");
}

function addFixture(fixture) {
    socket.emit('addFixture', { fixtureName: fixture, startDMXAddress: parseInt($('#newFixtureStartDMXAddress').val()) });
    $('#fixtureProfilesModal').modal("hide");
}

function viewFixtureChannels(fixtureID) {
    socket.emit('getFixtureChannels', { id: fixtureID });
    openTab('fixtureChannelsPage');
}

function viewFixtureSettings(fixtureID) {
    socket.emit('getFixtureSettings', { id: fixtureID });
    openTab('fixtureSettingsPage');
}

function updateFixtureChannelValue(self, fixtureID, channelID) {
    socket.emit('changeFixtureChannelValue', { id: fixtureID, cid: channelID, value: parseInt(self.value) })
}

function removeFixture(fixtureID) {
    if (confirm("Are you sure you want to delete this fixture?")) {
        socket.emit('removeFixture', { id: fixtureID });
        openTab('fixtures');
    }
}

function saveFixtureSettings(fixtureID) {
    socket.emit('editFixtureSettings', { id: fixtureID, name: $("#fixtureNameInput").val(), shortName: $("#fixtureShortNameInput").val(), startDMXAddress: $("#fixtureDMXAddressInput").val() });
}

function removeCue(cueID) {
    if (confirm("Are you sure you want to delete this cue?")) {
        socket.emit('removeCue', { id: cueID });
        openTab('cues');
    }
}

function saveCueSettings(cueID) {
    socket.emit('editCueSettings', { id: cueID, name: $("#cueNameInput").val(), time: $("#cueTimeInput").val() });
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

function viewCueSettings(cueID) {
    socket.emit('getCueSettings', { id: cueID });
    openTab('cueSettingsPage');
}

function openTab(tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    //for (i = 0; i < tablinks.length; i++) {
    //    tablinks[i].className = tablinks[i].className.replace(" active", "");
    //}

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    //evt.currentTarget.className += " active";
}

function titleCase(str) {
    return str.toLowerCase().split(' ').map(function (word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}