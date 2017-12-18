function openTab(evt, tabName) {
  var i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("content");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tab-item");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

function updateChannels(msg) {
  for (var i = 0; i <= 47; i++) {
    if ($("#cval-" + (i + 1)).text() != msg.channels[i]) {
      $("#cval-" + (i + 1)).addClass('green-text');
      $("#cval-" + (i + 1)).removeClass('red-text');
    } else {
      if ($("#cval-" + (i + 1)).hasClass("green-text")) {
        $("#cval-" + (i + 1)).removeClass('green-text');
      }
      $("#cval-" + (i + 1)).addClass('red-text');
    }
    $("#cval-" + (i + 1)).text(msg.channels[i]);
  };
  return 0;
}

function updateCues(msg) {
  $("#cues").empty();
  if (msg.cues.length != 0) {
    for (var i = 0; i < msg.cues.length; i++) {
      $("#cues").append("<div class=\"cue-item\" cueVal=\"" + i + "\"><h4>" + msg.cues[i].name + "</h4>" + msg.cues[i].description + "</div>");
    }
  }
  return 0;
}

$(document).ready(function () {
  document.getElementById("keyboardTabBtn").click();

  for (var i = 0; i <= 47; i++) {
    $("#Channels").append("<div class=\"col-1 channel\"><div class=\"channel-item\"><h2>" + (i + 1) + "</h2><h1 id=\"cval-" + (i + 1) + "\">0</h1></div></div>");
  }

  var socket = io.connect('http://' + document.domain + ':' + location.port + '/tonalite');

  socket.on('success', function (msg) {
    alert(msg.message);
  });

  socket.on('update chans', function (msg) {
    updateChannels(msg);
  });

  socket.on('update cues', function (msg) {
    updateCues(msg);
  });

  socket.on('cue settings', function (msg) {
    $("#cueName").val(msg.name);
    $("#cueDescription").val(msg.description);
    $("#cueTime").val(msg.time);
    $("#cueFollow").val(msg.follow);
  });

  socket.on('update all', function (msg) {
    updateChannels(msg);
    updateCues(msg);
  });

  $('.kbtn').click(function (event) {
    $('#commandInput').val($('#commandInput').val() + $(this).attr('inputVal'));
  });

  $('#updateCue').click(function (event) {
    socket.emit('update cue', { name: $('#cueName').val(), description: $('#cueDescription').val(), time: $('#cueTime').val(), follow: $('#cueFollow').val() });
  });

  $('#saveCue').click(function (event) {
    socket.emit('update cue', { name: $('#cueName').val(), description: $('#cueDescription').val(), time: $('#cueTime').val(), follow: $('#cueFollow').val() });
  });

  $("#cues").on("click", "div.cue-item", function () {
    socket.emit('cue info', { cue_id: $(this).attr('cueVal') });
  });

  $('#commandSubmitBtn').click(function (event) {
    socket.emit('command message', { command: $('#commandInput').val() });
    $('#commandInput').val("");
    return false;
  });

  $('#recordCueBtn').click(function (event) {
    socket.emit('command message', { command: "rnc" });
    return false;
  });

  $('#commandClearBtn').click(function (event) {
    $('#commandInput').val("");
    return false;
  });
});