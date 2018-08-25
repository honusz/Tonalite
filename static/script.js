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