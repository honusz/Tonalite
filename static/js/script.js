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
$(document).ready(function () {
  document.getElementById("keyboardTabBtn").click();

  for (var i = 0; i <= 47; i++) {
    $("#Channels").append("<div class=\"col-1 channel\"><div class=\"channel-item\"><h2>" + (i + 1) + "</h2><h1 id=\"cval-" + (i + 1) + "\">0</h1></div></div>");
  }

  var socket = io.connect('http://' + document.domain + ':' + location.port + '/tonalite');

  socket.on('update chans', function (msg) {
    for (var i = 0; i <= 47; i++) {
      $("#cval-" + (i + 1)).text(msg.channels[i]);
    };
  });

  $('.kbtn').click(function (event) {
    $('#commandInput').val($('#commandInput').val() + $(this).attr('inputVal'));
  });

  $('#commandSubmitBtn').click(function (event) {
    socket.emit('command message', { command: $('#commandInput').val() });
    $('#commandInput').val("");
    return false;
  });

  $('#commandClearBtn').click(function (event) {
    $('#commandInput').val("");
    return false;
  });
});