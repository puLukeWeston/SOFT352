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
var ROOM_SIZE = 6;

// Returns either the data associated with a set of user credentials, or false if they don't exist in the db
var isValidPassword = function(data, cb) {
  db.account.find({username:data.username, password:data.password}, function(err, res) {
    if(res[0])
      cb(res[0]);
    else
      cb(false);
  });
}

// Returns true or false depending on if the username already exists in the db
var isUsernameTaken = function(data, cb) {
  db.account.find({username:data.username}, function(err, res) {
    if(res[0])
      cb(true);
    else
      cb(false);
  });
}

// Adds a new set of credentials to the db
var addUser = function(data, cb) {
  db.account.insert({username:data.username, password:data.password}, function(err, res) {
    cb();
  });
}

var currentMap = Maps("blueprints");

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {

  socket.id = Math.random();
  // The socket associated with each socket.id is required for occasional use such as in the informLobby subroutine
  SOCKET_LIST[socket.id] = {socket:socket};

  // Upon receiving a signUp request
  socket.on('signUp', function(data) {
    // Check if the username is taken already & respond with false if it does
    isUsernameTaken(data, function(res) {
      if(res)
        socket.emit('signUpResponse', {success:false});
      // If it doesn't already exist, add a new user to the db with the given credentials
      else {
        addUser(data, function() {
          socket.emit('signUpResponse', {success:true});
        });
      }
    });
  });

  // Upon receiving a login request
  socket.on('login', function(data) {
    // Check to see if the credentials are valid
    isValidPassword(data, function(res) {
      // If they aren't respond to the client with a failure
      if(!res) {
        socket.emit('loginResponse', {success:false, reason:"Username/Password combination not recognised"});
        return;
      }

      // Create a temp boolean flag
      var found = false;
      // Search through all the clients connected to see if any of them already have the username associated with the attempted login
      for(var i in SOCKET_LIST) {
        if(SOCKET_LIST[i].username === data.username)
          found = true;
      }

      // If it wasn't found
      if(!found) {
        // Respond with a success
        socket.emit('loginResponse', {success:true, id:data.username});
        // Associate that username with the socket which made the request
        SOCKET_LIST[socket.id].username = data.username;
        informLobby();
      } else
        // If the boolean is true it means the account is already logged on (theoretically), or at least somebody on the account
        socket.emit('loginResponse', {success:false, reason:"Account already in use"});
    });
  });

  socket.on('joinRoom', function(data) {

    if(getRoomInformation(data.roomname).total < ROOM_SIZE) {

      if(data.choice === "C" && getRoomInformation(data.roomname).cats !== 0)
        socket.emit('joinRoomResponse', {success:false, reason:"There is already a cat in that room!"});
      else if(data.choice === "M" && getRoomInformation(data.roomname).total >= ROOM_SIZE - 1)
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
      SOCKET_LIST[i].socket.emit('lobbyInfo', pack);
    }
  }
}


createItems = function() {
  for(var i = 0; i < currentMap.taps.length; i++) {
    Tap(currentMap.taps[i].id, currentMap.taps[i].owner, currentMap.taps[i].x, currentMap.taps[i].y);
  }
}
createItems();

setInterval(function() {
  var packs = Entity.getFrameUpdateData();
  if(packs.removePack.player.length > 0) {
    for(var p in packs.removePack.player) {
      for(var i in SOCKET_LIST) {
        if(SOCKET_LIST[i].username !== undefined && SOCKET_LIST[i].username === packs.removePack.player[p].id) {
          SOCKET_LIST[i].roomname = "";
          SOCKET_LIST[i].choice = "";
        }
      }
    }
    informLobby();
  }
  // Send the updated info back to update the clients screen
  for(var i in SOCKET_LIST) {
    if(SOCKET_LIST[i].roomname === "Room1") {
      SOCKET_LIST[i].socket.emit('init', packs.initPack);
      SOCKET_LIST[i].socket.emit('update', packs.updatePack);
      SOCKET_LIST[i].socket.emit('remove', packs.removePack);
    }
  }
},1000/20);

// Every 10 seconds, perform this task
setInterval(function() {
  // Calculate how far below 250 the amount of cheeses is
  var amount = 250 - Cheese.listSize();
  // If there is an amount under 250
  if(amount >= 0)
    // Create that amount of new Cheeses randonly placed around the map (As long as their not colliding with a wall)
    for(var i = 0; i < amount; i++) {
      var x = randomInt(0, currentMap.width * 2);
      var y = randomInt(0, currentMap.height * 2);
      if(!currentMap.isPositionWall(x, y))
        var cheese = Cheese(x + " " + y + ": " + randomInt(0, 10000), x, y);
    }
}, 10000);
