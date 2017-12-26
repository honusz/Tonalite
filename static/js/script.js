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
  $("#cues-display").empty();
  if (msg.cues.length != 0) {
    if (msg.current_cue != 0) {
      $("#cues-display").append("<div class=\"cue-item no-hover\"><h4>Previous: " + msg.cues[msg.current_cue - 1].name + "</h4>" + msg.cues[msg.current_cue - 1].description + "</div>");
    }
    $("#cues-display").append("<div class=\"cue-item no-hover background-green\"><h4>Current: " + msg.cues[msg.current_cue].name + "</h4>" + msg.cues[msg.current_cue].description + "</div>");
    if (msg.current_cue != msg.cues.length - 1 && msg.cues.length > 1) {
      $("#cues-display").append("<div class=\"cue-item no-hover\"><h4>Next: " + msg.cues[msg.current_cue + 1].name + "</h4>" + msg.cues[msg.current_cue + 1].description + "</div>");
    }
    for (var i = 0; i < msg.cues.length; i++) {
      $("#cues").append("<div class=\"cue-item\" cueVal=\"" + i + "\"><h4>" + msg.cues[i].name + "</h4>" + msg.cues[i].description + "</div>");
      if (msg.selected_cue != null) {
        if (msg.selected_cue == i) {
          $("div[cueVal=" + i + "]").addClass("background-green");
        }
      }
    }
  }
  if (msg.selected_cue == null) {
    $("#cueName").val("");
    $("#cueDescription").val("");
    $("#cueTime").val("");
    $("#cueFollow").val("");
  }
  if (msg.cues.length != 0) {
    if ($(".hidden-item").hasClass("hidden")) {
      $(".hidden-item").removeClass('hidden');
    }
  } else {
    $(".hidden-item").addClass('hidden');
  }
  return 0;
}

function updateSubs(msg) {
  $("Submasters").empty();
  if (msg.submasters.length != 0) {
    for (var i = 0; i < msg.submasters.length; i++) {
      console.log("hi");
    }
  }
}

function settingsDropdown() {
  document.getElementById("settingsDropdown").classList.toggle("show");
}

$(document).ready(function () {
  document.getElementById("keyboardTabBtn").click();
  sliders = document.getElementsByClassName('slider');

  for (var i = 0; i < sliders.length; i++) {

    noUiSlider.create(sliders[i], {
      start: 0,
      connect: [true, false],
      orientation: "vertical",
      range: {
        'min': 0,
        'max': 255
      },
      direction: 'rtl',
      format: wNumb({
        decimals: 0
      })
    });
  }

  for (var i = 0; i <= 47; i++) {
    $("#Channels").append("<div class=\"col-1 channel\"><div class=\"channel-item\"><h2>" + (i + 1) + "</h2><h1 id=\"cval-" + (i + 1) + "\">0</h1></div></div>");
  }

  var socket = io.connect('http://' + document.domain + ':' + location.port + '/tonalite');

  socket.on('update chans', function (msg) {
    updateChannels(msg);
  });

  socket.on('update cues', function (msg) {
    updateCues(msg);
  });

  socket.on('cue settings', function (msg) {
    updateCues(msg);
    $("#cueName").val(msg.name);
    $("#cueDescription").val(msg.description);
    $("#cueTime").val(msg.time);
    $("#cueFollow").val(msg.follow);
  });

  socket.on('update all', function (msg) {
    updateChannels(msg);
    updateCues(msg);
    updateSubs(msg);
    if (msg.show.name != "") {
      $("#showName").val(msg.show.name);
      $("#showDescription").val(msg.show.description);
      $("#showAuthor").val(msg.show.author);
      $("#showCopyright").val(msg.show.copyright);
    }
    $("#serverIP").val(msg.tonaliteSettings.serverIP);
    $("#serverPort").val(msg.tonaliteSettings.serverPort);
    $("#sacnIP").val(msg.tonaliteSettings.sacnIP);
  });

  socket.on('redirect', function (msg) {
    window.location = 'http://' + document.domain + ':' + location.port + msg.url
  });

  $('.kbtn').click(function (event) {
    $('#commandInput').val($('#commandInput').val() + $(this).attr('inputVal'));
  });

  $('#updateCue').click(function (event) {
    socket.emit('update cue', { name: $('#cueName').val(), description: $('#cueDescription').val(), time: $('#cueTime').val(), follow: $('#cueFollow').val() });
  });

  $('#saveCue').click(function (event) {
    socket.emit('save cue', { name: $('#cueName').val(), description: $('#cueDescription').val(), time: $('#cueTime').val(), follow: $('#cueFollow').val() });
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
    socket.emit('command message', { command: "r q" });
    return false;
  });

  $("#cueUpBtn").click(function (event) {
    socket.emit('cue move', { action: "up" });
  });

  $("#cueDownBtn").click(function (event) {
    socket.emit('cue move', { action: "down" });
  });

  $("#deleteCue").click(function (event) {
    socket.emit('cue move', { action: "delete" });
  });

  $("#goCue").click(function (event) {
    socket.emit('command message', { command: "q 9949" });
  });

  $("#nextCue").click(function (event) {
    socket.emit('cue move', { action: "next" });
  });

  $("#lastCue").click(function (event) {
    socket.emit('cue move', { action: "last" });
  });

  $("#saveShowBtn").click(function (event) {
    socket.emit('save show', { name: $("#showName").val(), description: $("#showDescription").val(), author: $("#showAuthor").val(), copyright: $("#showCopyright").val() });
  });

  $("#clearShowBtn").click(function (event) {
    if (confirm('Are you sure you want clear everything?')) {
      $("#showName").val("");
      $("#showDescription").val("");
      $("#showAuthor").val("");
      $("#showCopyright").val("");
      socket.emit('clear show', "none");
    }
  });

  $('#commandClearBtn').click(function (event) {
    $('#commandInput').val("");
    return false;
  });

  $('#saveSettingsBtn').click(function (event) {
    alert("The server must be restarted for the changes to take effect.");
    socket.emit('save settings', { serverIP: $("#serverIP").val(), serverPort: $("#serverPort").val(), sacnIP: $("#sacnIP").val() });
  });

  $('#resetSettingsBtn').click(function (event) {
    $("#serverIP").val("127.0.0.1");
    $("#serverPort").val("9898");
    $("#sacnIP").val("127.0.0.1");
  });

  $('#quitBtn').click(function (event) {
    if (confirm('Are you sure you want to quit? Your current show will not be saved.')) {
      socket.emit('quit tonalite', {});
    }
  });
});