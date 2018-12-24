var io = require('socket.io-client');
var should = require('should');
var assert = require('chai').assert;

var socketURL = 'http://0.0.0.0:2000';

var options = {
  transports: ['websocket'],
  'force new connection': true
};

var correctCred = {'username':'Luke','password':'pass'};
var correctCred2 = {'username':'David','password':'soft352'};
var correctCred3 = {'username':'AzureDiamond','password':'hunter2'};
var incorrectCred = {'username':'David','password':'false'};

describe("Server-side App", function() {

  var player1 = null;
  var player2 = null;

  beforeEach(function(done) {
    player1 = io.connect(socketURL, options);
    player1.on('connect', function(data) {
      player1.emit('login', correctCred);
      player1.emit('joinRoom', {roomname:"default", id:1});
      done();
    });

  });

  beforeEach(function(done) {
    player2 = io.connect(socketURL, options);
    player2.on('connect', function(data) {
      player2.emit('login', correctCred2);
      player2.emit('joinRoom', {roomname:"default", id:2});
      done();
    });
  });

  afterEach(function(done) {
    if(player1.connected && player2.connected) {
      player1.disconnect();
      player2.disconnect();
    } else if(player1.connected) {
      player1.disconnect();
    } else if(player2.connected) {
      player2.disconnect();
    }
    if(!player1.connected && !player2.connected)
      done();
  });

  it('Should accept correct credentials', function(done) {
    var player0 = io.connect(socketURL, options);
    player0.on('connect', function(data) {
      player0.emit('login', correctCred3);
      player0.emit('joinRoom', {roomname:"default", id:1});
    });
    player0.on('loginResponse', function(res) {
      console.log(res);
      res.success.should.equal(true);
      player0.disconnect();
      done();
    });
  });

  it('Should deny access if account is already in use', function(done) {
    var player3 = io.connect(socketURL, options);
    player3.on('connect', function(data) {
      player3.emit('login', correctCred);
      player3.emit('joinRoom', {roomname:"default", id:1});
    });
    player3.on('loginResponse', function(res) {
      console.log(res);
      res.success.should.equal(false);
      player3.disconnect();
      done();
    });
  });

  it('Should not accept incorrect credentials', function(done) {
    var player4 = io.connect(socketURL, options);
    player4.on('connect', function(data) {
      player4.emit('login', incorrectCred);
      player4.emit('joinRoom', {roomname:"default", id:1});
    });
    player4.on('loginResponse', function(res) {
      console.log(res);
      res.success.should.equal(false);
      player4.disconnect();
      done();
    });
  });

  it('Should deny access to a room which already has two players', function(done) {
    var player5 = io.connect(socketURL, options);
    player5.on('connect', function(data) {
      player5.emit('login', correctCred3);
      player5.emit('joinRoom', {roomname:"default", id:3});
    });
    player5.on('joinRoomResponse', function(res) {
      console.log(res);
      res.success.should.equal(false);
      player5.disconnect();
      done();
    });
  });

  it('Should create a Mouse at 1125x965 with default variables', function(done) {
    player1.emit('initReq');
    player1.on('init', function(initPack) {
      for(var i = 0; i < initPack.player.length; i++){
        if(initPack.player[i].assignment === "M"){
          initPack.player[i].x.should.equal(1125);
          initPack.player[i].y.should.equal(965);
          initPack.player[i].assignment.should.equal("M");
          initPack.player[i].spd.should.equal(16);
          initPack.player[i].maxSpd.should.equal(16);
          initPack.player[i].score.should.equal(0);
          done();
        }
      }
    });
  });

  it('Should create a Cat at 480x580 with default variables', function(done) {
    player2.emit('initReq');
    player2.on('init', function(initPack) {
      for(var i = 0; i < initPack.player.length; i++){
        if(initPack.player[i].assignment === "C"){
          initPack.player[i].x.should.equal(480);
          initPack.player[i].y.should.equal(580);
          initPack.player[i].assignment.should.equal("C");
          initPack.player[i].spd.should.equal(16);
          initPack.player[i].maxSpd.should.equal(16);
          initPack.player[i].score.should.equal(0);
          done();
        }
      }
    });
  });

  describe("Accepting KeyPresses", function() {

    it('Should accept Up key press from player 1 to move Mouse', function(done) {
      player1.emit('keyPress', {inputId:'up',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M"){
            updatePack.player[i].x.should.equal(1125);
            assert.isBelow(updatePack.player[i].y, 965);
            done();
          }
        }
      });
    });

    it('Should accept Down key press from player 1 to move Mouse', function(done) {
      player1.emit('keyPress', {inputId:'down',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M"){
            updatePack.player[i].x.should.equal(1125);
            assert.isAbove(updatePack.player[i].y, 965);
            done();
          }
        }
      });
    });

    it('Should accept Left key press from player 1 to move Mouse', function(done) {
      player1.emit('keyPress', {inputId:'left',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M"){
            assert.isBelow(updatePack.player[i].x, 1125);
            updatePack.player[i].y.should.equal(965);
            done();
          }
        }
      });
    });

    it('Should accept Right key press from player 1 to move Mouse', function(done) {
      player1.emit('keyPress', {inputId:'right',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M") {
            assert.isAbove(updatePack.player[i].x, 1125);
            updatePack.player[i].y.should.equal(965);
            done();
          }
        }
      });
    });

    it('Should accept Up key press from player 2 to move Cat', function(done) {
      player2.emit('keyPress', {inputId:'up',state:true});
      player2.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "C"){
            updatePack.player[i].x.should.equal(480);
            assert.isBelow(updatePack.player[i].y, 580);
            done();
          }
        }
      });
    });

    it('Should accept Down key press from player 2 to move Cat', function(done) {
      player2.emit('keyPress', {inputId:'down',state:true});
      player2.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "C"){
            updatePack.player[i].x.should.equal(480);
            assert.isAbove(updatePack.player[i].y, 580);
            done();
          }
        }
      });
    });

    it('Should accept Left key press from player 2 to move Cat', function(done) {
      player2.emit('keyPress', {inputId:'left',state:true});
      player2.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "C"){
            assert.isBelow(updatePack.player[i].x, 480);
            updatePack.player[i].y.should.equal(580);
            done();
          }
        }
      });
    });

    it('Should accept Right key press from player 2 to move Cat', function(done) {
      player2.emit('keyPress', {inputId:'right',state:true});
      player2.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "C") {
            assert.isAbove(updatePack.player[i].x, 480);
            updatePack.player[i].y.should.equal(580);
            done();
          }
        }
      });
    });

  });
});
