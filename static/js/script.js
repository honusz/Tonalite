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
    if (msg.channels[i] > $("#cval-" + (i + 1)).attr('cvalue')) {
      if ($("#cval-" + (i + 1)).hasClass("purple-text")) {
        $("#cval-" + (i + 1)).removeClass('purple-text');
      } else {
        $("#cval-" + (i + 1)).removeClass('red-text');
      }
      $("#cval-" + (i + 1)).addClass('green-text');
    } else if (msg.channels[i] < $("#cval-" + (i + 1)).attr('cvalue')) {
      if ($("#cval-" + (i + 1)).hasClass("green-text")) {
        $("#cval-" + (i + 1)).removeClass('green-text');
      } else {
        $("#cval-" + (i + 1)).removeClass('red-text');
      }
      $("#cval-" + (i + 1)).addClass('purple-text');
    } else {
      if ($("#cval-" + (i + 1)).hasClass("green-text")) {
        $("#cval-" + (i + 1)).removeClass('green-text');
      } else {
        $("#cval-" + (i + 1)).removeClass('purple-text');
      }
      $("#cval-" + (i + 1)).addClass('red-text');
    }
    $("#cval-" + (i + 1)).text(Math.round((msg.channels[i] / 255) * 100)).attr('cvalue', msg.channels[i]);
  }
  return 0;
}

function updateCues(msg) {
  $("#cues").empty();
  $("#cues-display").empty();
  if (msg.cues.length != 0) {
    if (msg.current_cue != null) {
      if (msg.current_cue != 0) {
        $("#cues-display").append("<div class=\"cue-item no-hover disable-selection\"><h4>Previous: <span class=\"cue-name\">" + msg.cues[msg.current_cue - 1].name + "</span></h4><span class=\"cue-description\">" + msg.cues[msg.current_cue - 1].description + "</span></div>");
      }
      $("#cues-display").append("<div class=\"cue-item no-hover background-green disable-selection\"><h4>Current: <span class=\"cue-name\">" + msg.cues[msg.current_cue].name + "</span></h4><span class=\"cue-description\">" + msg.cues[msg.current_cue].description + "</span></div>");
      if (msg.current_cue != msg.cues.length - 1 && msg.cues.length > 1) {
        $("#cues-display").append("<div class=\"cue-item no-hover\"><h4>Next: <span class=\"cue-name\">" + msg.cues[msg.current_cue + 1].name + "</span></h4><span class=\"cue-description\">" + msg.cues[msg.current_cue + 1].description + "</span></div>");
      }
    } else {
      $("#cues-display").append("<div class=\"cue-item no-hover disable-selection\"><h4>Next: <span class=\"cue-name\">" + msg.cues[0].name + "</span></h4><span class=\"cue-description\">" + msg.cues[0].description + "</span></div>");
    }
    for (var i = 0; i < msg.cues.length; i++) {
      $("#cues").append("<div class=\"cue-item disable-selection\" cueVal=\"" + i + "\"><h4><span class=\"cue-name\">" + msg.cues[i].name + "</span></h4><span class=\"cue-description\">" + msg.cues[i].description + "</span></div>");
      if (msg.selected_cue != null) {
        if (msg.selected_cue == i) {
          $("div[cueVal=" + i + "]").addClass("background-green");
        }
      }
    }
  }
  $(".cue-name").succinct({ size: 20 });
  $(".cue-description").succinct({ size: 70 });
  if (msg.selected_cue == null) {
    $("#cueName").val("");
    $("#cueDescription").val("");
    $("#cueTime").val("");
    $("#cueFollow").val("");
  }
  if (msg.cues.length != 0) {
    if ($(".hidden-item").css('display') == "none") {
      $(".hidden-item").css('display', 'inline-block');
    }
  } else {
    $(".hidden-item").css('display', 'none');
  }
  return 0;
}

function updateSubs(msg) {
  $("#Submasters").empty();
  if (msg.submasters.length != 0) {
    for (var i = 0; i < msg.submasters.length; i++) {
      $("#Submasters").append("<div class=\"col-1 submaster\"><div class=\"sliders\"><div class=\"slider\" id=\"sub-" + i + "\"></div></div><div class=\"subtitle\"><button id=\"sub-btn-" + i + "\" class=\"btn btn-yellow sub-btn disable-selection\">" + msg.submasters[i].name + "</button></div></div>");
    }
  }
  if (!document.getElementById("addSubBtn")) {
    $("#Submasters").append("<div class=\"col-2 submaster\"><button class=\"btn btn-green disable-selection\" id=\"addSubBtn\"><i class=\"fas fa-plus-square\"></i> New Submaster</button></div>");
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
  $(".sub-btn").succinct({ size: 12 });
}

function settingsDropdown() {
  document.getElementById("settingsDropdown").classList.toggle("show");
}

$(window).bind("load", function () {
  document.getElementById("keyboardTabBtn").click();

  var keyListener = new window.keypress.Listener();

  keyListener.simple_combo("alt r", function () {
    socket.emit('command message', { command: "c rs" });
  });

  keyListener.simple_combo("alt c", function () {
    socket.emit('command message', { command: "r q" });
  });

  keyListener.simple_combo("alt n", function () {
    socket.emit('cue move', { action: "next" });
  });

  keyListener.simple_combo("alt l", function () {
    socket.emit('cue move', { action: "last" });
  });

  var grandmaster = document.getElementById('grandmaster');
  noUiSlider.create(grandmaster, {
    start: 100,
    connect: [true, false],
    range: {
      'min': 0,
      'max': 100
    },
    format: wNumb({
      decimals: 0
    })
  });
  grandmaster.noUiSlider.on('slide', function () {
    socket.emit('update grand val', { value: grandmaster.noUiSlider.get() });
  });

  function updateGrandmaster(msg) {
    grandmaster.noUiSlider.set(msg.grandmaster);
  }

  for (var i = 0; i <= 47; i++) {
    $("#Channels").append("<div class=\"col-1 channel disable-selection\"><div class=\"channel-item\"><h2>" + (i + 1) + "</h2><h1 id=\"cval-" + (i + 1) + "\" cvalue=\"0\" class=\"red-text\">0</h1></div></div>");
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

  var disconnectModal = document.getElementById('disconnectModal');

  socket.on('connect', function (error) {
    if (disconnectModal.style.display == "block") {
      disconnectModal.style.display = "none";
    }
  });

  socket.on('connect_error', function (error) {
    disconnectModal.style.display = "block";
  });

  toastr.options = {
    "closeButton": false,
    "showDuration": "300",
    "hideDuration": "1000",
    "positionClass": "toast-bottom-right",
    "timeOut": "2500"
  }

  socket.on('alert', function (msg) {
    if (msg.alertType == "error") {
      toastr.error(msg.alert);
    } else if (msg.alertType == "warning") {
      toastr.warning(msg.alert);
    } else if (msg.alertType == "info") {
      toastr.info(msg.alert);
    } else if (msg.alertType == "success") {
      toastr.success(msg.alert);
    }
  });

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
        $("#sub-channels").append("<div class=\"col-5\"><input type=\"number\" placeholder=\"Channel:\" value=\"" + msg.channels[i].channel + "\" id=\"sub-channel-" + i + "-channel\" min=\"1\" max=\"48\"></div><div class=\"col-5\"><input type=\"number\" placeholder=\"Value:\" value=\"" + msg.channels[i].value + "\" id=\"sub-channel-" + i + "-value\" min=\"0\" max=\"100\"></div><div class=\"col-1\"><button class=\"btn btn-green btn-full btn-tall sub-chan-save\" subChan=\"" + i + "\"><i class=\"fas fa-save\"></i></button></div><div class=\"col-1\"><button class=\"btn btn-red btn-full btn-tall sub-chan-delete\" subChan=\"" + i + "\"><i class=\"fas fa-trash-alt\"></i></button></div>");
      }
    }
    subModal.style.display = "block";
  });

  socket.on('update all', function (msg) {
    updateChannels(msg);
    updateCues(msg);
    updateSubs(msg);
    updateGrandmaster(msg);
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
        $("#users").append("<div class=\"col-11\"><input type=\"text\" placeholder=\"User:\" value=\"" + msg.tonaliteSettings.users[i][0] + "\" ></div><div class=\"col-1\"><button class=\"btn btn-red btn-full btn-tall user-delete\" user=\"" + i + "\"><i class=\"fas fa-trash-alt\"></i></button></div>");
      }
    }
  });

  socket.on('set grand val', function (msg) {
    updateChannels(msg);
    updateGrandmaster(msg);
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
    if (!isMobile.any) {
      $('#commandInput').focus();
    }
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
    socket.emit('edit sub chan', { action: "save", chan: Math.round(this.getAttribute('subChan')), channel: $('#sub-channel-' + Math.round(this.getAttribute('subChan')) + '-channel').val(), value: $('#sub-channel-' + Math.round(this.getAttribute('subChan')) + '-value').val() });
  });

  $("#sub-channels").on("click", "button.sub-chan-delete", function () {
    socket.emit('edit sub chan', { action: "delete", chan: Math.round(this.getAttribute('subChan')) });
  });

  $("#users").on("click", "button.user-delete", function () {
    socket.emit('edit users', { action: "delete", user: Math.round(this.getAttribute('user')) });
  });

  $('#addUserBtn').click(function () {
    socket.emit('edit users', { action: "new", user: prompt("Please enter the new username"), password: prompt("Please enter the new password") });
  });

  $('#commandSubmitBtn').click(function () {
    socket.emit('command message', { command: $('#commandInput').val() });
    $('#commandInput').val("");
  });

  $('#commandReleaseBtn').click(function () {
    socket.emit('command message', { command: "c rs" });
  });

  $('#recordCueBtn').click(function () {
    socket.emit('command message', { command: "r q" });
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

  $("#duplicateCue").click(function () {
    socket.emit('cue move', { action: "duplicate" });
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
  });

  $('#commandInput').keypress(function (e) {
    var keycode = (e.keyCode ? e.keyCode : e.which);
    if (keycode == '13') {
      socket.emit('command message', { command: $('#commandInput').val() });
      $('#commandInput').val("");
    }
  });

  $('#usersBtn').click(function () {
    userModal.style.display = "block";
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
