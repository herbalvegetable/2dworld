const express = require('express');
const socket = require('socket.io');

let app = express();
let port = process.env.PORT || 5000;
let server = app.listen(port, ()=>{
	console.log(`Server listening to port ${port}`);
});
app.use(express.static('public'));

class Client{
	static idList = [];
}
class Player{
	static info = {};
}
class Grid{
	static list = []; //change the way the grids are created (use types)
	static cols = 100; //100
	static rows = 100; //100
	static l = 50;
	static typeNum = null;
	static typeList = [ // 0 - NOT selectable by player, 1 - IS selectable by player
		['air', 0],
		['wall', 1],
		['mud', 1],
		['booster', 1],
		['gateClosed', 1],
		['gateOpen', 0],
		['pressurePlate', 1],
		['drawingPad', 1],
		['wireUnpowered', 1], //troublesome to implement block
		['wirePowered', 0], //troublesome to implement block
		['bush', 1],
	]; //IMPORTANT! - update when adding new block

	static initTypeNum(){
		this.typeNum = {};
		for (var i = 0; i < this.typeList.length; i++) {
			var _type = this.typeList[i];
			this.typeNum[_type[0]] = i;
		}
	}
	static initTypes(){
		for (var y = 0; y < this.cols; y++) {
			var subList = [];
			for (var x = 0; x < this.rows; x++) {
				subList.push({
					type: Grid.typeNum.air,
					rot: 0,
					extra: {},
				});
			}
			this.list.push(subList);
		}
	}
}
Grid.initTypeNum();
Grid.initTypes();

let io = socket(server);

io.on('connection', socket=>{
	console.log(`Client connected: ${socket.id}`);
	Client.idList.push(socket.id);
	io.emit('setNewId', {
		id: socket.id,
		gridInfo: {
			list: Grid.list,
			typeList: Grid.typeList,
		},
	});
	socket.on('updatePlayerInfo', data=>{ //update player info
		Player.info[data.id] = data.info;
	});
	socket.on('disconnect', ()=>{
		console.log(`client disconnected: ${socket.id}`); //get disconnected socket id
		Client.idList.splice(Client.idList.indexOf(socket.id), 1);
		delete Player.info[socket.id];
	});
	socket.on('updateBlock', data=>{
		Grid.list[data.index[1]][data.index[0]].type = data.type;
		Grid.list[data.index[1]][data.index[0]].rot = data.rot;
		Grid.list[data.index[1]][data.index[0]].extra = data.extra;
		io.emit('updateOthersBlock', data);
	});
});

let FPS = 60;
setInterval(()=>{
	io.emit('loopGame');
	io.emit('updateOthersInfo', Player.info);
}, 1000/FPS);
