var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");

var SOCKET_LIST = { };
var PLAYER_LIST = { };

var Player = function(id) {
  var self = {
    x:250,
    y:250,
    id:id,
    // Assign random number to tell the clients apart for now
    number: "" + Math.floor(10 * Math.random()),
    // Declare defaults
    pressingRight:false,
    pressingLeft:false,
    pressingUp:false,
    pressingDown:false,
    maxSpd:5,
  }

  // Used to move the players character based on recieved key press info
  self.updatePosition = function() {
    if(self.pressingRight)
      self.x += self.maxSpd;
    if(self.pressingLeft)
      self.x -= self.maxSpd;
    if(self.pressingUp)
      self.y -= self.maxSpd;
    if(self.pressingDown)
      self.y += self.maxSpd;
  }
  return self;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
  // Give the client an ID (temporary functionality)
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  // Create the client a new Player object
  var player = Player(socket.id);
  // Add the player object to the list of Players
  PLAYER_LIST[socket.id] = player;

  // If the client disconnects
  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    delete PLAYER_LIST[socket.id];
  });

  // When recieving key press information, change the directional state
  socket.on('keyPress',function(data){
    if(data.inputId === 'right')
      player.pressingRight = data.state;
    if(data.inputId === 'left')
      player.pressingLeft = data.state;
    if(data.inputId === 'up')
      player.pressingUp = data.state;
    if(data.inputId === 'down')
      player.pressingDown = data.state;
  });
});

setInterval(function() {
  // Data to send back to the client
  var pack = [];
  // Loop through the clients and move their character
  for(var i in PLAYER_LIST) {
    var player = PLAYER_LIST[i];
    player.updatePosition();
    pack.push({
      x:player.x,
      y:player.y,
      number:player.number
    });
  }
  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('newPositions', pack);
  }
},1000/20);
