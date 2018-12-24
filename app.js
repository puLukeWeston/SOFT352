var mongojs = require("mongojs");
var db = mongojs('localhost:27017/jomAndTerry', ['account']);

var express = require('express');
var app = express();
var serv = require('http').Server(app);
var entity = require('./classes/Entity.js');
var maps = require('./classes/Map.js');

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");

var SOCKET_LIST = {};
var CONNECTED_PLAYERS = {};

var isValidPassword = function(data, cb) {
  db.account.find({username:data.username, password:data.password}, function(err, res) {
    if(res[0])
      cb(res[0]);
    else
      cb(false);
  });
}

var isUsernameTaken = function(data, cb) {
  db.account.find({username:data.username}, function(err, res) {
    if(res[0])
      cb(true);
    else
      cb(false);
  });
}

var addUser = function(data, cb) {
  db.account.insert({username:data.username, password:data.password}, function(err, res) {
    cb();
  });
}

var count = 0;
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {
  // Give the client an ID (temporary functionality)
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  socket.on('signUp', function(data) {
    isUsernameTaken(data, function(res) {
      if(res)
        socket.emit('signUpResponse', {success:false});
      else {
        addUser(data, function() {
          socket.emit('signUpResponse', {success:true});
        });
      }
    });
  });

  socket.on('login', function(data) {
    isValidPassword(data, function(res) {
      var userDetails = JSON.parse(JSON.stringify(res));
      var found = false;
      for(var i in CONNECTED_PLAYERS)
        if(CONNECTED_PLAYERS[i].userID === userDetails.ID)
          found = true;

      if(found === false)
        if(res) {
          socket.emit('loginResponse', {success:true, id:userDetails.ID});
          CONNECTED_PLAYERS[userDetails.ID] = {socketID:socket.id, userID:userDetails.ID};
        }
        else
          socket.emit('loginResponse', {success:false, reason:"Username/Password combination not recognised"});
      else
        socket.emit('loginResponse', {success:false, reason:"Account already in use"});
    });
  });

  socket.on('joinRoom', function(data) {

    if(Player.listSize() <= 2) {
      socket.emit('joinRoomResponse', {success:true});
      var assignment = "M";
      var clients = "";
      for(var i in Player.list) {
        clients += Player.list[i].assignment;
      }

      // If the String contains both a C and an M, don't assign the client to anything
      if(clients.indexOf("M") > -1 && clients.indexOf("C") > -1) {
        console.log("Already have two clients");
        //delete Player.list[socket.id];
      } else if(clients.indexOf("M") > -1)
          assignment = "C";
      Player.onConnect(socket, data.id, assignment);
    } else
      socket.emit('joinRoomResponse', {success:false});
  });

  //  When a Player clicks on a Tap that belongs to their assignment, it emits a 'twistTap'
  socket.on('twistTap', function(data) {
    var targetTap;
    for(var i in Tap.list) {
      if(data.id === Tap.list[i].id)
        targetTap = Tap.list[i];
    }
    // Turn the Taps running condition to true or false depending on the direction passed
    if(data.direction === "on") {
      targetTap.running = true;
    } else if(data.direction === "off") {
      targetTap.running = false;
    }
  });

  // If the client disconnects
  socket.on('disconnect',function(){
    delete SOCKET_LIST[socket.id];
    for(var i in CONNECTED_PLAYERS)
      if(CONNECTED_PLAYERS[i].socketID === socket.id){
        Player.onDisconnect(CONNECTED_PLAYERS[i].userID);
        delete CONNECTED_PLAYERS[i];
      }
  });

});

setInterval(function() {
  var packs = Entity.getFrameUpdateData();
  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    var socket = SOCKET_LIST[i];
    socket.emit('update', packs.updatePack);
    socket.emit('remove', packs.removePack);
  }
},1000/20);

currentMap = Maps();

createItems = function() {
  for(var i = 0; i < currentMap.width * 2; i += 80){
    for(var j = 50; j < currentMap.height * 2; j += 80) {
      if(!currentMap.isPositionWall(i, j))
        var cheese = Cheese(i + " " + j, i, j);
    }
  }
  //Tap(1, 1584, 448, "M");
  //Tap(2, 100, 100, "M");
}
createItems();
