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
  SOCKET_LIST[socket.id] = {socket:socket};

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

      if(!res) {
        socket.emit('loginResponse', {success:false, reason:"Username/Password combination not recognised"});
        return;
      }

      var found = false;
      for(var i in SOCKET_LIST) {
        if(SOCKET_LIST[i].username === userDetails.username)
          found = true;
      }

      if(!found) {
          socket.emit('loginResponse', {success:true, id:userDetails.username});
          SOCKET_LIST[socket.id].username = userDetails.username;
          informLobby();
      } else
        socket.emit('loginResponse', {success:false, reason:"Account already in use"});
    });
  });

  socket.on('joinRoom', function(data) {

    if(getRoomInformation(data.roomname).total < 6) {

      if(data.choice === "C" && getRoomInformation(data.roomname).cats !== 0)
        socket.emit('joinRoomResponse', {success:false, reason:"There is already a cat in that room!"});
      else if(data.choice === "M" && getRoomInformation(data.roomname).total >= 5)
        socket.emit('joinRoomResponse', {success:false, reason:"There are too many mice in there already!"});
      else {
        SOCKET_LIST[socket.id].roomname = data.roomname;
        SOCKET_LIST[socket.id].choice = data.choice;
        socket.emit('joinRoomResponse', {success:true});
        Player.onConnect(socket, SOCKET_LIST[socket.id].username, data.choice);
        informLobby();
      }

    } else
      socket.emit('joinRoomResponse', {success:false});
  });

  socket.on('leaveRoom', function() {
    SOCKET_LIST[socket.id].roomname = "";
    SOCKET_LIST[socket.id].choice = "";
    Player.onDisconnect(SOCKET_LIST[socket.id].username);

    //socket.emit('leaveResponse', {success:true});
    informLobby();

  })

  //  When a Player clicks on a Tap that belongs to their assignment, it emits a 'twistTap'
  socket.on('twistTap', function(data) {
    var targetTap;
    for(var i in Tap.list) {
      if(data.id === Tap.list[i].id)
        targetTap = Tap.list[i];
    }
    // Turn the Taps running condition to true or false depending on the direction passed
    if(data.direction === "on")
      targetTap.running = true;
    else if(data.direction === "off")
      targetTap.running = false;
  });

  // If the client disconnects
  socket.on('disconnect',function(){
    Player.onDisconnect(SOCKET_LIST[socket.id].username);
    delete SOCKET_LIST[socket.id];
  });

});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min+1) + min);
}

function getRoomInformation(room) {
  var cats = 0;
  var mice = 0;
  for(var i in SOCKET_LIST) {
    if(SOCKET_LIST[i].roomname == room) {
      if(SOCKET_LIST[i].choice == "C")
        cats++;
      if(SOCKET_LIST[i].choice == "M")
        mice++;
    }
  }
  return {
    total: cats + mice,
    cats: cats,
    mice: mice
  };
}

function informLobby() {
  for(var i in SOCKET_LIST) {
    if(SOCKET_LIST[i].username !== undefined) {
      var pack = {
        Room1: getRoomInformation("Room1")
      }
      console.log(pack);
      SOCKET_LIST[i].socket.emit('lobbyInfo', pack);
    }
  }
}

currentMap = Maps("blueprints");

createItems = function() {
  for(var i = 0; i < 250; i++) {
    var x = randomInt(0, currentMap.width * 2);
    var y = randomInt(0, currentMap.height * 2);
    if(!currentMap.isPositionWall(x, y))
    var cheese = Cheese(x + " " + y + ": " + randomInt(0, 10000), x, y);
  }
  Tap(1, "M", 1584, 448);
  Tap(2, "M", 100, 100);
}
createItems();

setInterval(function() {
  var packs = Entity.getFrameUpdateData();
  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    if(SOCKET_LIST[i].roomname === "Room1") {
      SOCKET_LIST[i].socket.emit('init', packs.initPack);
      SOCKET_LIST[i].socket.emit('update', packs.updatePack);
      SOCKET_LIST[i].socket.emit('remove', packs.removePack);
    }
  }
},1000/20);

setInterval(function() {
  var amount = 200 - Cheese.listSize();
  if(amount >= 0)
    for(var i = 0; i < amount; i++) {
      var x = randomInt(0, currentMap.width * 2);
      var y = randomInt(0, currentMap.height * 2);
      if(!currentMap.isPositionWall(x, y))
        var cheese = Cheese(x + " " + y + ": " + randomInt(0, 10000), x, y);
    }
}, 10000);
