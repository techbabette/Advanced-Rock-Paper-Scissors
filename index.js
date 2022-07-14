const { SSL_OP_TLS_BLOCK_PADDING_BUG } = require('constants');

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.use(express.static(__dirname + '/public'));

listOfUsers = [];
listOfPlayers = [];
listOfRooms = [];
class User {
  constructor(id, username, pref){
    this.id = id;
    this.username = username;
    this.pref = pref;
  }
}
class Player{
	constructor(id, username, pref){
		this.id = id;
		this.username = username
		this.health = 100;
    this.move;
    this.pref = pref;
	}
}
class Room{
	constructor(Player1, Player2){
		this.players = [Player1, Player2];
		this.name = Player1.username + ` (${Player1.pref}) vs ` + Player2.username + ` (${Player2.pref})`;
    this.finished = 0;
	}
}
//Determine which player won the contested throw
function checkContestWinner(players){
  if(players[0].move === 'swords'){
    if(players[1].move === 'bows') return(0);
    if(players[1].move === 'shields') return(1);
  }
  if(players[0].move === 'shields'){
    if(players[1].move === 'swords') return(0);
    if(players[1].move === 'bows') return(1);
  }
  if(players[0].move === 'bows'){
    if(players[1].move === 'shields') return(0);
    if(players[1].move === 'swords') return(1);
  }
}
//Return text to be printed out to players
function calculateDamage(Room){
  players = Room.players;
  damage = 10;
  winner = checkContestWinner(players);
  if(players[winner].pref === players[winner].move) damage *= 2;
  //Winner did X damage to player opposite of winner
  /*
  If player[1] is the winner, deal damage to player[1 - 1] (player[0])
  if player[0] is the winner, deal damage to player[1 - 0] (player[1])
  */
  players[1 - winner].health -= damage;
  if(players[1-winner].health <= 0)
  {
    Room.finished = 1;
    return(`${players[winner].username} dealt the killing blow to ${players[1 - winner].username}, winning the game`);
  }
  console.log(players);
  return(`${players[winner].username} did ${damage} damage to ${players[1-winner].username}, they now have ${players[1-winner].health} hp`);
}
function roomCreation(){
  if(listOfUsers.length < 2) return false;
  Player1 = new Player(listOfUsers[0].id, listOfUsers[0].username, listOfUsers[0].pref);
  listOfPlayers.push(Player1);
  Player2 = new Player(listOfUsers[1].id, listOfUsers[1].username, listOfUsers[1].pref);
  listOfPlayers.push(Player2);
  listOfUsers.splice(0, 2);
  console.log("New room created!");
  console.log(listOfUsers);
  currentRoom = new Room(Player1, Player2)
  listOfRooms.push(currentRoom);
  for (var P of currentRoom.players){
    sid = P.id
    io.to(sid).emit('roomJoined', currentRoom.name);
  }
  console.log(listOfRooms);
}
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('setUsername', data =>{
      listOfUsers.push(new User(socket.id, data.name, data.class));
      io.to(socket.id).emit('joinEvent', data.name)
      console.log(listOfUsers)
      roomCreation();
    });
    socket.on('moveSelected', (move) =>{
      //Find player that made move and room where it was made
      console.log("User with ID of " + socket.id + " made move " + move);
      var Player = listOfPlayers.find(element => element.id == socket.id);
      var Room = listOfRooms.find(element => element.players.find(elem => elem.id == socket.id));
      let movesMade = true;
      Player.move = move;
      console.log(listOfPlayers);
      console.log(Player.username + "'s move is " + Player.move);
      //If either of the players hasn't made a move, the variable is false
      for (var P of Room.players){
        if(typeof P.move == 'undefined')movesMade = false;
      }
      //If both players chose the same move
      if (movesMade == true){
      if(Room.players[0].move === Room.players[1].move){
        Room.players[0].move = undefined;
        Room.players[1].move = undefined;
        for (var P of currentRoom.players){
            sid = P.id
            io.to(sid).emit('moveMade', {type: 1});
          }
      }
      else{
        text = calculateDamage(Room);
        moves = [Room.players[0].move,Room.players[1].move];
        Room.players[0].move = undefined;
        Room.players[1].move = undefined;
        for (var i = 0; i<2; i++){
          sid = Room.players[i].id;
          io.to(sid).emit('moveMade', {type: 0, move: moves[1-i], text: text});
        }
        //Process the game ending, send both players to queue;
        if(Room.finished === 1){
          listOfPlayers = listOfPlayers.filter(player => player.username != Room.players[0].username && player.username != Room.players[1].username);
          for (var P of Room.players){
            listOfUsers.push(new User(P.id, P.username, P.pref));
          }
          listOfRooms = listOfRooms.filter(room => room.name != Room.name);
          roomCreation();
        }
      }
      }
    })
  });

http.listen(3000, () => {
  console.log('listening on *:3000');
});