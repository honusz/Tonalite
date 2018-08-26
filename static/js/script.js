var socket = io('http://' + document.domain + ':' + location.port);
document.getElementById("fixturesTab").click();

socket.on('fixtures', function (fixtures) {
    console.log(fixtures);
    if (fixtures.length != 0) {
        $("#fixturesList").empty();
        fixtures.forEach(function (value, i) {
            $("#fixturesList").append("<div class=\"col-4\"><div class=\"fixtureItem\" onclick=\"viewFixture('" + fixtures[i].id + "')\"><p>" + fixtures[i].shortName + "</p></div></div>");
        });
    }
});

socket.on('message', function (msg) {
    console.log(msg.type + ': ' + msg.content);
});

socket.on('fixtureProfiles', function (profiles) {
    $("#fixtureProfilesList").empty();
    profiles.forEach(function (value) {
        $("#fixtureProfilesList").append("<li class=\"list-group-item fixtureProfileItem\" onclick=\"addFixture('" + value + "')\">" + titleCase(value) + "</li>");
    });
});

socket.on('fixtureChannels', function (msg) {
    $("#fixtureChannels").empty();
    $("#fixtureName").text(msg.name);
    msg.channels.forEach(function (channel, i) {
        $("#fixtureChannels").append("<label for=\"" + channel.type + "\">" + channel.name + "</label><input type=\"range\" class=\"custom-range\" id=\"" + channel.type + "\" max=\"" + channel.displayMax + "\" min=\"" + channel.displayMin + "\" value=\"" + channel.value + "\" oninput=\"updateFixtureChannelValue(this, '" + msg.id + "', " + i + ")\">");
    });
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

function viewFixture(fixtureID) {
    socket.emit('getFixtureChannels', { id: fixtureID });
    openTab(event, 'fixtureChannelsPage');
}

function updateFixtureChannelValue(self, fixtureID, channelID) {
    socket.emit('changeFixtureChannelValue', {id: fixtureID, cid: channelID, value: parseInt(self.value)})
}

function openTab(evt, tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

function titleCase(str) {
    return str.toLowerCase().split(' ').map(function (word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ');
}