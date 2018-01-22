var socket = io.connect('http://' + document.domain + ':' + location.port + '/tonalite');

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
      $("#cval-" + (i + 1)).addClass('green-text').removeClass('red-text');
    } else {
      if ($("#cval-" + (i + 1)).hasClass("green-text")) {
        $("#cval-" + (i + 1)).removeClass('green-text');
      }
      $("#cval-" + (i + 1)).addClass('red-text');
    }
    $("#cval-" + (i + 1)).text(msg.channels[i]);
  }
  return 0;
}

function updateCues(msg) {
  $("#cues").empty();
  $("#cues-display").empty();
  if (msg.cues.length != 0) {
    if (msg.current_cue != null) {
      if (msg.current_cue != 0) {
        $("#cues-display").append("<div class=\"cue-item no-hover\"><h4>Previous: " + msg.cues[msg.current_cue - 1].name + "</h4>" + msg.cues[msg.current_cue - 1].description + "</div>");
      }
      $("#cues-display").append("<div class=\"cue-item no-hover background-green\"><h4>Current: " + msg.cues[msg.current_cue].name + "</h4>" + msg.cues[msg.current_cue].description + "</div>");
      if (msg.current_cue != msg.cues.length - 1 && msg.cues.length > 1) {
        $("#cues-display").append("<div class=\"cue-item no-hover\"><h4>Next: " + msg.cues[msg.current_cue + 1].name + "</h4>" + msg.cues[msg.current_cue + 1].description + "</div>");
      }
    } else {
      $("#cues-display").append("<div class=\"cue-item no-hover\"><h4>Next: " + msg.cues[0].name + "</h4>" + msg.cues[0].description + "</div>");
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
  $("#Submasters").empty();
  if (msg.submasters.length != 0) {
    for (var i = 0; i < msg.submasters.length; i++) {
      $("#Submasters").append("<div class=\"col-1 submaster\"><div class=\"sliders\"><div class=\"slider\" id=\"sub-" + i + "\"></div></div><div class=\"subtitle\"><button id=\"sub-btn-" + i + "\" class=\"btn btn-yellow sub-btn\">" + msg.submasters[i].name + "</button></div></div>")
    }
  }
  var sliders = $('.slider');
  for (var s = 0; s < sliders.length; s++) {

    noUiSlider.create(sliders[s], {
      start: msg.submasters[s].value,
      connect: [true, false],
      direction: 'rtl',
      orientation: "vertical",
      range: {
        'min': 0,
        'max': 100
      },
      format: wNumb({
        decimals: 0
      })
    });
    sliders[s].noUiSlider.on('slide', function () {
      socket.emit('update sub val', { sub: this.target.getAttribute('id'), value: this.get() });
    });
  }
  $(".sub-btn").succinct({size: 12});
  $("#Submasters").append("<div class=\"col-2 submaster\"><button class=\"btn btn-green\" id=\"addSubBtn\"><i class=\"fas fa-plus-square\"></i> New Submaster</button></div>")
}

function settingsDropdown() {
  document.getElementById("settingsDropdown").classList.toggle("show");
}

$(document).ready(function () {
  document.getElementById("keyboardTabBtn").click();

  for (var i = 0; i <= 47; i++) {
    $("#Channels").append("<div class=\"col-1 channel\"><div class=\"channel-item\"><h2>" + (i + 1) + "</h2><h1 id=\"cval-" + (i + 1) + "\">0</h1></div></div>");
  }

  var subModal = document.getElementById('subSettingsModal');
  var subModalCloseBtn = document.getElementsByClassName("sub-modal-close")[0];
  subModalCloseBtn.onclick = function () {
    subModal.style.display = "none";
  }

  var userModal = document.getElementById('usersModal');
  var userModalCloseBtn = document.getElementsByClassName("user-modal-close")[0];
  userModalCloseBtn.onclick = function () {
    userModal.style.display = "none";
  }

  socket.on('update chans', function (msg) {
    updateChannels(msg);
  });

  socket.on('update chans and subs', function (msg) {
    updateChannels(msg);
    updateSubs(msg);
  });

  socket.on('update subs', function (msg) {
    updateSubs(msg);
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

  socket.on('sub settings', function (msg) {
    $("#subName").val(msg.name);
    $("#subValue").val(msg.value);
    $("#sub-channels").empty();
    if (msg.channels.length != 0) {
      for (var i = 0; i < msg.channels.length; i++) {
        $("#sub-channels").append("<div class=\"col-5\"><input type=\"number\" placeholder=\"Channel:\" value=\"" + msg.channels[i].channel + "\" id=\"sub-channel-" + i + "-channel\" min=\"1\" max=\"48\"></div><div class=\"col-5\"><input type=\"number\" placeholder=\"Value:\" value=\"" + msg.channels[i].value + "\" id=\"sub-channel-" + i + "-value\" min=\"0\" max=\"255\"></div><div class=\"col-1\"><button class=\"btn btn-green btn-full btn-tall sub-chan-save\" subChan=\"" + i + "\"><i class=\"fas fa-save\"></i></button></div><div class=\"col-1\"><button class=\"btn btn-red btn-full btn-tall sub-chan-delete\" subChan=\"" + i + "\"><i class=\"fas fa-trash-alt\"></i></button></div>")
      }
    }
    subModal.style.display = "block";
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
    $("#users").empty();
    if (msg.tonaliteSettings.users.length != 0) {
      for (var i = 0; i < msg.tonaliteSettings.users.length; i++) {
        $("#users").append("<div class=\"col-11\"><input type=\"text\" placeholder=\"User:\" value=\"" + msg.tonaliteSettings.users[i][0] + "\" ></div><div class=\"col-1\"><button class=\"btn btn-red btn-full btn-tall user-delete\" user=\"" + i + "\"><i class=\"fas fa-trash-alt\"></i></button></div>")
      }
    }
  });

  socket.on('update chans and cues', function (msg) {
    updateChannels(msg);
    updateCues(msg);
  });

  socket.on('update settings', function (msg) {
    $("#serverIP").val(msg.tonaliteSettings.serverIP);
    $("#serverPort").val(msg.tonaliteSettings.serverPort);
    $("#sacnIP").val(msg.tonaliteSettings.sacnIP);
  });

  socket.on('redirect', function (msg) {
    window.location = 'http://' + document.domain + ':' + location.port + msg.url
  });

  $('.kbtn').click(function () {
    $('#commandInput').val($('#commandInput').val() + $(this).attr('inputVal'));
  });

  $('#updateCue').click(function () {
    socket.emit('update cue', "nothing");
  });

  $('#saveCue').click(function () {
    socket.emit('save cue', { name: $('#cueName').val(), description: $('#cueDescription').val(), time: $('#cueTime').val(), follow: $('#cueFollow').val() });
  });

  $("#cues").on("click", "div.cue-item", function () {
    socket.emit('cue info', { cue_id: $(this).attr('cueVal') });
  });

  $("#Submasters").on("click", "button.sub-btn", function () {
    socket.emit('sub info', { sub: this.id });
  });

  $("#Submasters").on("click", "button#addSubBtn", function () {
    socket.emit('add sub', "nothing");
  });

  $('#deleteSubBtn').click(function () {
    subModal.style.display = "none";
    socket.emit('remove sub', "nothing");
  });

  $("#sub-channels").on("click", "button.sub-chan-save", function () {
    socket.emit('edit sub chan', { action: "save", chan: parseInt(this.getAttribute('subChan')), channel: $('#sub-channel-' + parseInt(this.getAttribute('subChan')) + '-channel').val(), value: $('#sub-channel-' + parseInt(this.getAttribute('subChan')) + '-value').val() });
  });

  $("#sub-channels").on("click", "button.sub-chan-delete", function () {
    socket.emit('edit sub chan', { action: "delete", chan: parseInt(this.getAttribute('subChan')) });
  });

  $("#users").on("click", "button.user-delete", function () {
    socket.emit('edit users', { action: "delete", user: parseInt(this.getAttribute('user')) });
  });

  $('#addUserBtn').click(function () {
    socket.emit('edit users', { action: "new", user: prompt("Please enter the new username"), password: prompt("Please enter the new password") });
  });

  $('#commandSubmitBtn').click(function () {
    socket.emit('command message', { command: $('#commandInput').val() });
    $('#commandInput').val("");
    return false;
  });

  $('#commandReleaseBtn').click(function () {
    socket.emit('command message', { command: "c rs" });
    return false;
  });

  $('#recordCueBtn').click(function () {
    socket.emit('command message', { command: "r q" });
    return false;
  });

  $("#cueUpBtn").click(function () {
    socket.emit('cue move', { action: "up" });
  });

  $("#cueDownBtn").click(function () {
    socket.emit('cue move', { action: "down" });
  });

  $("#deleteCue").click(function () {
    socket.emit('cue move', { action: "delete" });
  });

  $("#goCue").click(function () {
    socket.emit('command message', { command: "q 9949" });
  });

  $("#nextCue").click(function () {
    socket.emit('cue move', { action: "next" });
  });

  $("#releaseCues").click(function () {
    socket.emit('cue move', { action: "release" });
  });

  $("#lastCue").click(function () {
    socket.emit('cue move', { action: "last" });
  });

  $("#saveShowBtn").click(function () {
    socket.emit('save show', { name: $("#showName").val(), description: $("#showDescription").val(), author: $("#showAuthor").val(), copyright: $("#showCopyright").val() });
  });

  $("#saveSubSettingsBtn").click(function () {
    socket.emit('save sub', { name: $("#subName").val(), value: $("#subValue").val() });
  });

  $("#addSubChanBtn").click(function () {
    socket.emit('add sub chan', "nothing");
  });

  $("#clearShowBtn").click(function () {
    if (confirm('Are you sure you want clear everything?')) {
      $("#showName").val("");
      $("#showDescription").val("");
      $("#showAuthor").val("");
      $("#showCopyright").val("");
      socket.emit('clear show', "none");
    }
  });

  $('#commandClearBtn').click(function () {
    $('#commandInput').val("");
    return false;
  });

  $('#usersBtn').click(function () {
    userModal.style.display = "block";
    return false;
  });

  $('.saveSettingsBtn').click(function () {
    alert("The server must be restarted for IP changes to take effect.");
    socket.emit('save settings', { serverIP: $("#serverIP").val(), serverPort: $("#serverPort").val(), sacnIP: $("#sacnIP").val() });
  });

  $('#resetSettingsBtn').click(function () {
    $("#serverIP").val("127.0.0.1");
    $("#serverPort").val("9898");
    $("#sacnIP").val("127.0.0.1");
  });
});
