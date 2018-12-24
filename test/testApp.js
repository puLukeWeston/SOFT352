var io = require('socket.io-client');
var should = require('should');
var assert = require('chai').assert;

var socketURL = 'http://0.0.0.0:2000';

var options = {
  transports: ['websocket'],
  'force new connection': true
};

var correctCred = {'username':'Luke','password':'pass'};
var incorrectCred = {'username':'David','password':'false'};

describe("Server-side App", function() {

  var player1 = null;
  var player2 = null;

  beforeEach(function(done) {
    player1 = io.connect(socketURL, options);
    console.log("Connecting Player1");
    player1.on('connect', function(data) {
      player1.emit('login', correctCred);
      player1.emit('joinRoom', "default");
      done();
    });
    player1.on('disconnect', function() {
      console.log("Player1 Disconnected");
    });
  });

  /*beforeEach(function(done) {
    player2 = io.connect(socketURL, options);
    player2.emit('joinRoom', "default");
    console.log("Connecting Player2");
    player2.on('connect', function(data) {
      player2.emit('login', correctCred);
      done();
    });
    player2.on('disconnect', function() {
      console.log("Player2 Disconnected");
    });
  });*/

  afterEach(function(done) {
    if(player1.connected) {
      console.log("Disconnecting Player 1");
      player1.disconnect();
    }
    /*if(player2.connected) {
      console.log("Disconnecting Player2");
      player2.disconnect();
    }*/
    done();
  });

  it('Should accept correct credentials', function(done) {
    player1.on('loginResponse', function(res) {
      //console.log(res);
      res.success.should.equal(true);
      done();
    });
  });

  it('Should create a Mouse at 1125x965 with default variables', function(done) {
    player1.on('init', function(initPack) {
      //console.log(initPack);
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

  /*it('Should create a Cat at 480x580 with default variables', function(done) {
    player2.on('init', function(initPack) {
      for(var i = 0; i < initPack.player.length; i++){
        if(initPack.player[i].assignment === "C"){
          initPack.player[i].x.should.equal(480);
          initPack.player[i].y.should.equal(580);
          initPack.player[i].assignment.should.equal("C");
          initPack.player[i].spd.should.equal(16);
          initPack.player[i].maxSpd.should.equal(16);
          initPack.player[i].score.should.equal(0);
        }
      }

      done();
    });
  });*/

  describe("Accepting KeyPresses", function() {

    it('Should accept Up key being pressed to move Player', function(done) {
      player1.emit('keyPress', {inputId:'up',state:true});
      player1.emit('keyPress', {inputId:'up',state:true});
      player1.emit('keyPress', {inputId:'up',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M"){
            updatePack.player[i].x.should.equal(1125);
            assert.isBelow(updatePack.player[i].y, 965);
            done();
          } else if(updatePack.player[i].assignment === "C") {
            updatePack.player[i].x.should.equal(480);
            assert.isBelow(updatePack.player[i].y, 580);
            done();
          }
        }
      });
    });

    it('Should accept Down key being pressed to move Player', function(done) {
      player1.emit('keyPress', {inputId:'down',state:true});
      player1.emit('keyPress', {inputId:'down',state:true});
      player1.emit('keyPress', {inputId:'down',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M"){
            updatePack.player[i].x.should.equal(1125);
            assert.isAbove(updatePack.player[i].y, 965);
            done();
          } else if(updatePack.player[i].assignment === "C") {
            updatePack.player[i].x.should.equal(480);
            assert.isAbove(updatePack.player[i].y, 580);
            done();
          }
        }
      });
    });

    it('Should accept Left key being pressed to move Player', function(done) {
      player1.emit('keyPress', {inputId:'left',state:true});
      player1.emit('keyPress', {inputId:'left',state:true});
      player1.emit('keyPress', {inputId:'left',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          if(updatePack.player[i].assignment === "M"){
            assert.isBelow(updatePack.player[i].x, 1125);
            updatePack.player[i].y.should.equal(965);
            done();
          } else if(updatePack.player[i].assignment === "C") {
            assert.isBelow(updatePack.player[i].x, 480);
            updatePack.player[i].y.should.equal(580);
            done();
          }
        }
      });
    });

    it('Should accept Right key being pressed to move Player', function(done) {
      player1.emit('keyPress', {inputId:'right',state:true});
      player1.emit('keyPress', {inputId:'right',state:true});
      player1.emit('keyPress', {inputId:'right',state:true});
      player1.on('update', function(updatePack) {
        for(var i = 0; i < updatePack.player.length; i++){
          console.log(updatePack.player[i].assignment);
          if(updatePack.player[i].assignment === "M") {
            assert.isAbove(updatePack.player[i].x, 1125);
            updatePack.player[i].y.should.equal(965);
            done();
          } else if(updatePack.player[i].assignment === "C") {
            assert.isAbove(updatePack.player[i].x, 480);
            updatePack.player[i].y.should.equal(580);
            done();
          }
        }
      });
    });
  });
});
