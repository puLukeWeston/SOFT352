var mongojs = require("mongojs");
var db = mongojs('localhost:27017/jomAndTerry', ['account']);

const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');

var serv = require('http').Server(app);
var entity = require('./classes/Entity.js');
var maps = require('./classes/Map.js');

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.get('/',function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server Started.");

var SOCKET_LIST = {};
var RECENTLY_USED = [];
var ROOM_SIZE = 6;
var GAME_LENGTH = 60000;
var WINNING_AMOUNT = 100;
var GAMES_STARTED = [ {roomname:"Room1", time:Date.now()} ];

// Returns either the data associated with a set of user credentials, or false if they don't exist in the db
var isValidPassword = function(data, cb) {
  db.account.find({username:data.username}, function(err, res) {
    if(res[0] !== undefined) {
      var hash = res[0].password;
      cb(bcrypt.compareSync(data.password, hash));
    } else
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
  var hash = bcrypt.hashSync(data.password, saltRounds);
  db.account.insert({username:data.username, password:hash}, function(err, res) {
    cb();
  });
}

var currentMap = Maps("blueprints");
for(var i = 0; i < currentMap.taps.length; i++) {
  Tap(currentMap.taps[i].id, currentMap.taps[i].owner, currentMap.taps[i].x, currentMap.taps[i].y);
}
Cheese.generate();

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket) {

  socket.id = Math.random();
  // The socket associated with each socket.id is required for occasional use such as in the informLobby subroutine
  SOCKET_LIST[socket.id] = {socket:socket};

  // If the client refreshed their page they might still have a valid token stores in the session
  socket.on('attemptReconnect', function(data) {
    for(var i in RECENTLY_USED) {
      // If any of the recently disconnected clients had the same token
      if(data.token === RECENTLY_USED[i].token) {
        // Respond with a successful reconnect and shift the data to the new socket
        SOCKET_LIST[socket.id].username = RECENTLY_USED[i].username;
        SOCKET_LIST[socket.id].token = RECENTLY_USED[i].token;
        socket.emit('reconnect', {result:true, id:SOCKET_LIST[socket.id].username});
        informLobby();
        break;
      }
    }
  });

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
        // Create a new token relating to the username, secret, & time
        jwt.sign({user:data.username}, 'secrets', function(err, token) {
          // If the username already existed in the RECENTLY_USED array, remove them now as they would have a new token
          for(var i in RECENTLY_USED) {
            if(RECENTLY_USED[i].username === data.username)
              delete RECENTLY_USED[i];
          }
          // Respond with a success
          socket.emit('loginResponse', {success:true, id:data.username, token:token});
          SOCKET_LIST[socket.id].token = token;
        });
        // Associate that username with the socket which made the request
        SOCKET_LIST[socket.id].username = data.username;
        informLobby();
      } else
        // If the boolean is true it means the account is already logged on (theoretically), or at least somebody on the account
        socket.emit('loginResponse', {success:false, reason:"Account already in use"});
    });
  });

  socket.on('joinRoom', function(data) {

    if(SOCKET_LIST[socket.id].username !== undefined) {
      if(getRoomInformation(data.roomname).total < ROOM_SIZE) {

        if(data.choice === "C" && getRoomInformation(data.roomname).cats !== 0)
          socket.emit('joinRoomResponse', {success:false, reason:"There is already a cat in that room!"});
        else if(data.choice === "M" && getRoomInformation(data.roomname).total >= ROOM_SIZE - 1)
          socket.emit('joinRoomResponse', {success:false, reason:"There are too many mice in there already!"});
        else {
          SOCKET_LIST[socket.id].roomname = data.roomname;
          SOCKET_LIST[socket.id].choice = data.choice;
          socket.emit('joinRoomResponse', {success:true, cheese:Cheese.getAllInitPack(), tap:Tap.getAllInitPack()});
          Player.onConnect(socket, SOCKET_LIST[socket.id].username, data.choice);
          informLobby();
        }

      } else
        socket.emit('joinRoomResponse', {success:false});
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

    // If the client had logged in they would have a username
    if(SOCKET_LIST[socket.id].username !== undefined) {
      // If the username already existed in the RECENTLY_USED array
      for(var i in RECENTLY_USED) {
        if(RECENTLY_USED[i].username === SOCKET_LIST[socket.id].username)
        // Remove the old entry
          delete RECENTLY_USED[i];
      }
      // Add the disconnected client to the RECENTLY_USED array
      RECENTLY_USED.push({username:SOCKET_LIST[socket.id].username, token:SOCKET_LIST[socket.id].token, time:Date.now()});
    }
    delete SOCKET_LIST[socket.id];
  });

});

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

setInterval(function() {
  // Get the details of the entities within the game
  var packs = Entity.getFrameUpdateData();
  // Create an array to hold details of games that have reached their time limit
  var endedGames = [];

      // If we wait until after the players are removed from the rooms (as is done below) then it retains data from
      // previous game when they join a new one

  // Cycle through the games currently running
  for(var t in GAMES_STARTED) {
    // If the game duration is more than the maximum allowed
    if(Date.now() - GAMES_STARTED[t].time > GAME_LENGTH) {
      // The cat wins because the time has ran out
      var winner = null;
      for(var i in SOCKET_LIST) {
        if(SOCKET_LIST[i].choice === "C") {
          winner = SOCKET_LIST[i].username
          break;
        }
      }
      // Add the room name to the list along with the details of why it is over
      endedGames.push({roomname:GAMES_STARTED[t].roomname, reason:"Time ran out!", winner:winner});
      // Restart the timer for the game
      GAMES_STARTED[t].time = Date.now();
      Cheese.generate();
    }
  }

  for(var p in packs.updatePack.player) {
    // If a player reaches the maximum score it means they would have won
    if(packs.updatePack.player[p].score >= WINNING_AMOUNT) {
      // Find the SOCKET_LIST entry relating to that player
      for(var i in SOCKET_LIST) {
        if(SOCKET_LIST[i].username === packs.updatePack.player[p].id) {
          // Add the room name and the details of why the game is over
          endedGames.push({roomname:SOCKET_LIST[i].roomname, reason:"Score limit reached!", winner:packs.updatePack.player[p].id});
          // Restart the timer of the game
          for(var t in GAMES_STARTED) {
            if(GAMES_STARTED[t].roomname === SOCKET_LIST[i].roomname) {
              GAMES_STARTED[t].time = Date.now();
              Cheese.generate();
              // Break the loop when found
              break;
            }
          }
        }
      }
    }
  }

  // If any of the games have ended
  for(var g in endedGames) {
    var removePack = Entity.getRemovePack();
    for(var i in SOCKET_LIST) {
      // Find the clients connected to that game
      if(SOCKET_LIST[i].roomname === endedGames[g].roomname) {
        // Alert them that the game has finished, and who the winner is
        SOCKET_LIST[i].socket.emit('gameOver', {reason:endedGames[g].reason, winner:endedGames[g].winner});
        // Disconnect the players from the room 
        for(var p in Player.list) {
          if(Player.list[p].id === SOCKET_LIST[i].username)
            Player.onDisconnect(SOCKET_LIST[i].username);
        }

        // Reset the SOCKET_LIST details as they would have returned to the lobby
        SOCKET_LIST[i].roomname = "";
        SOCKET_LIST[i].choice = "";
        // Get a new version of the removePack (as the cheese will now be gone)
        // Send it to those which were in the room that has now ended
        SOCKET_LIST[i].socket.emit('remove', removePack);
        informLobby();
      }
    }
  }

  // For those still in games; send the updated info back to update the clients canvas
  for(var i in SOCKET_LIST) {
    if(SOCKET_LIST[i].roomname === "Room1") {
      // Find out when their game started so the user can be informed of how long is left
      var started = null;
      for(var g in GAMES_STARTED) {
        if(GAMES_STARTED[g].roomname === SOCKET_LIST[i].roomname) {
          started = GAMES_STARTED[g].time;
          break;
        }
      }
      SOCKET_LIST[i].socket.emit('init', packs.initPack);
      SOCKET_LIST[i].socket.emit('update', packs.updatePack);
      SOCKET_LIST[i].socket.emit('remove', packs.removePack);
      SOCKET_LIST[i].socket.emit('timeLeft', Math.round((Date.now() - started) / 1000));
    }
  }

  // If any of the players have died
  for(var i = 0; i < packs.removePack.player.length; i++) {
    if(packs.removePack.player[i].reason === "died") {
      for(var s in SOCKET_LIST) {
        // Set their details back to default as they have been removed from the room
        if(SOCKET_LIST[s].username !== undefined && packs.removePack.player[i].id === SOCKET_LIST[s].username) {
          SOCKET_LIST[s].roomname = "";
          SOCKET_LIST[s].choice = "";
          informLobby();
        }
      }
    }
  }

},1000/20);

// Remove RECENTLY_USED details after 30 seconds
setInterval(function() {
  for(var i in RECENTLY_USED) {
    if(Date.now() - RECENTLY_USED[i].time >= 30000)
      delete RECENTLY_USED[i];
  }
}, 30000);
