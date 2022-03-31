let socket = io.connect('http://localhost:5000/');
//let socket = io.connect('https://world2d.herokuapp.com/');//change

let canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', ()=>{
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	Player.initSelectedTypePos();
});
canvas.addEventListener('contextmenu', e=>{
	if(e.button == 2){
		e.preventDefault();
	}
});
let key = {};
window.addEventListener('keydown', e=>{
	key[e.keyCode] = true;
});
window.addEventListener('keyup', e=>{
	key[e.keyCode] = false;
	if(!key[Player.controls[4]] && !Player.canInteract){
		Player.canInteract = true;
	}
});
let mouse = {};
canvas.addEventListener('mousemove', e=>{
	mouse.x = e.clientX;
	mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', e=>{
	if(e.button == 0){
		mouse.down = true;
	}
	if(e.button == 2){
		mouse.rightClick = true;
	}
});
canvas.addEventListener('mouseup', e=>{
	if(e.button == 0){
		mouse.down = false;
	}
	if(e.button == 2){
		mouse.rightClick = false; 
	}
});
window.addEventListener('wheel', e=>{
	if(e.deltaY < 0){
		Player.changeSelectedType(-1);
	}
	else if(e.deltaY > 0){
		Player.changeSelectedType(1);
	}
});

class Client{
	static id = null;
}
socket.on('setNewId', data=>{
	if(Client.id != null)return;
	Client.id = data.id;
	Grid.init(data.gridInfo);
	Player.init();
});

class Camera{
	static xpos = 0;
	static ypos = 0;
	static lockOnPlayer(){
		this.xpos = Player.xpos;
		this.ypos = Player.ypos;
	}
}
class Grid{
	static list = [];
	static l = 50;
	static defaultStyle = {
		img: document.getElementById('grass'),
		colour: ['green', 'green', 2],
	}
	static typeNum = null; // get from index.js
	static typeList = null; // get from index.js
	static init(gridInfo){
		this.typeList = gridInfo.typeList;
		this.typeNum = {};
		for (var i = 0; i < this.typeList.length; i++) {
			var _type = this.typeList[i];
			this.typeNum[_type[0]] = i;
		}
		//init updated world
		var gridList = gridInfo.list;
		for (var y = 0; y < gridList.length; y++) {
			var subList = [];
			for (var x = 0; x < gridList[y].length; x++) {
				var type = gridList[y][x].type;
				var index = [x, y];
				var extra = gridList[y][x].extra != undefined ? gridList[y][x].extra : {};
				let newGrid = new Grid(x * this.l, y * this.l, type, index, extra);
				newGrid.rot = gridList[y][x].rot;
				subList.push(newGrid);
			}
			this.list.push(subList);
		}
		this.initNeighbours();
	}
	static initNeighbours(){
		for (var i = 0; i < this.list.length; i++) {
			for (var j = 0; j < this.list[i].length; j++) {
				var _grid = this.list[i][j];
				_grid.initNeighbours();
			}
		}
	}
	static create(){
		for (var i = 0; i < this.list.length; i++) {
			for (var j = 0; j < this.list[i].length; j++) {
				this.list[i][j].create();
			}
		}
		this.checkPlayerWithinGrids();
	}
	static checkPlayerWithinGrids(){
		var gridList = []; //list of grids touching player
		for (var i = 0; i < this.list.length; i++) {
			for (var j = 0; j < this.list[i].length; j++) {
				var _grid = this.list[i][j];
				if(_grid.checkPlayerWithinGrid()){
					gridList.push(_grid);
				}
			}
		}
		var touchingMud = false;
		var touchingBush = false;
		for (var i = 0; i < gridList.length; i++) {
			var _grid = gridList[i];
			switch(_grid.type){
				case Grid.typeNum.mud:
				touchingMud = true;
				break;
				case Grid.typeNum.bush:
				touchingBush = true;
				break;
			}
		}
		//Touching mud
		if(touchingMud && !Player.isSlowed){
			Player.maxSpeed /= 2.5;
			Player.incSpeed /= 2.5;
			Player.isSlowed = true;
		}
		else{
			Player.maxSpeed = Player.initialMaxSpeed;
			Player.incSpeed = Player.initialIncSpeed;
			Player.isSlowed = false;
		}
		//Touching bush
		Player.isHidden = touchingBush;

		//Touching booster
		for (var i = 0; i < gridList.length; i++) {
			var _grid = gridList[i];
			if(_grid.type == Grid.typeNum.booster){
				if(Math.abs(Player.pushX) < _grid.maxPower){
					Player.pushX += Math.cos(_grid.rot) * _grid.power;
				}
				if(Math.abs(Player.pushY) < _grid.maxPower){
					Player.pushY += Math.sin(_grid.rot) * _grid.power;
				}
			}
		}
	}
	static getCoords(xpos, ypos){
		return {
			x: xpos/this.l,
			y: ypos/this.l,
		}
	}
	static getRelativePos(xpos, ypos){
		var x, y;
		if(Camera.xpos != null && Camera.ypos != null){
			x = canvas.width/2 - Camera.xpos + xpos;
			y = canvas.height/2 - Camera.ypos + ypos;
		}
		return {
			x: x,
			y: y,
		}
	}
	static curDrawingPad = null;
	static onStopDrawing(){
		if(this.curDrawingPad != null){
			if(!key[Player.controls[4]] || !this.curDrawingPad.checkMouse()){
				if(this.curDrawingPad.drawInfo.length > 0){
					this.curDrawingPad.drawingPosList.push(this.curDrawingPad.drawInfo);
					this.curDrawingPad.updateOthersBlock({
						drawingPosList: this.curDrawingPad.drawingPosList,
					});
				}
				this.curDrawingPad.drawInfo = [];
				this.curDrawingPad.prevXpos = null;
				this.curDrawingPad.prevYpos = null;
				//console.log(this.curDrawingPad.drawingPosList);
				this.curDrawingPad = null;
				console.log('stopped drawing');
			}	
		}
	}
	constructor(xpos, ypos, type, index, extra){
		this.xpos = xpos;
		this.ypos = ypos;
		this.l = Grid.l;
		this.index = index;
		this.rot = 0;
		this.initType = type=>{
			this.type = type;
			this.isPowered = false;
			switch(type){
				case Grid.typeNum.air: //air
				this.state = 0; //0 - not solid, 1 - solid
				this.style = {
					img: null,
					colour: [null, null, 2],
				}
				break;
				case Grid.typeNum.wall: //wall
				this.state = 1;
				this.style = {
					img: document.getElementById('wall'),
					colour: ['black', 'black', 2],
				}
				break;
				case Grid.typeNum.mud: //mud
				this.state = 0;
				this.style = {
					img: document.getElementById('mud'),
					colour: ['brown', 'brown', 2],
				}
				break;
				case Grid.typeNum.booster: //booster
				this.state = 0;
				this.style = {
					img: document.getElementById('booster'),
					colour: ['blue', 'cyan', 2],
				}
				this.power = 4;
				this.maxPower = 20;
				break;
				case Grid.typeNum.gateClosed: //gateClosed
				this.state = 1;
				this.style = {
					img: document.getElementById('gateClosed'),
					colour: ['yellow', 'yellow', 2],
				}
				break;
				case Grid.typeNum.gateOpen: //gateOpen
				this.state = 0;
				this.style = {
					img: document.getElementById('gateOpen'),
					colour: [null, 'yellow', 2],
				}
				break;
				case Grid.typeNum.pressurePlate: //pressurePlate
				this.state = 0;
				this.style = {
					img: document.getElementById('pressurePlate'),
					colour: ['gray', 'gray', 2],
				}
				this.isPowered = false;
				this.deactivateTimer = {
					count: 0,
					delay: 60, //60*1 - 1 second
					trigger: false,
				}
				break;
				case Grid.typeNum.drawingPad: //drawingPad
				this.state = 0;
				this.style = {
					img: document.getElementById('drawingPad'),
					colour: ['white', null, 2],
				}
				this.prevXpos = null;
				this.prevYpos = null;
				this.colour = 'black';
				this.lineWidth = 3;
				this.drawInfo = [];
				if(extra.drawingPosList != undefined || extra.drawingPosList != null){
					this.drawingPosList = extra.drawingPosList;
				}
				else{
					this.drawingPosList = [];
				}
				/* 
				this.drawingPosList = [];
				[
					[
						[xpos, ypos],
						[xpos, ypos],
						...
					],
					[
						[xpos, ypos],
						[xpos, ypos],
						...
					],
					...
				]

				*/
				break;
				case Grid.typeNum.wireUnpowered: //wireUnpowered
				this.state = 0;
				this.style = {
					img: document.getElementById('wireUnpowered'),
					colour: ['rgb(50, 0, 0)', 'rgb(50, 0, 0)', 2],
				}
				this.colour = 'rgb(50, 0, 0)';
				this.lineWidth = 20;
				this.isPowered = false;
				break;
				case Grid.typeNum.wirePowered: //wirePowered
				this.state = 0;
				this.style = {
					img: document.getElementById('wirePowered'),
					colour: ['red', 'red', 2],
				}
				this.colour = 'red';
				this.lineWidth = 20;
				this.isPowered = true;
				break;
				case Grid.typeNum.bush: //bush
				this.state = 0;
				this.style = {
					img: document.getElementById('bush'),
					colour: ['green', 'black', 2],
				}
				break;
			}
		}
		this.initType(type);
		this.getState = type=>{
			var initialType = this.type;
			this.initType(type);
			var state = this.state;
			this.initType(initialType);
			return state;
		}
		this.neighbours = [];
		this.initNeighbours = ()=>{
			this.neighbours = [];
			try{
				this.neighbours.push(Grid.list[this.index[1]][this.index[0]-1]); //left
			}
			catch{
				this.neighbours.push(null);
			}
			try{
				this.neighbours.push(Grid.list[this.index[1]][this.index[0]+1]); //right
			}
			catch{
				this.neighbours.push(null);
			}
			try{
				this.neighbours.push(Grid.list[this.index[1]-1][this.index[0]]); //up
			}
			catch{
				this.neighbours.push(null);
			}
			try{
				this.neighbours.push(Grid.list[this.index[1]+1][this.index[0]]); //down
			}
			catch{
				this.neighbours.push(null);
			}
		}
		this.create = ()=>{
			if(this.checkWithinScreen()){ //only render if within client's screen
				if(document.visibilityState == 'visible'){//prevent lag from closed tabs
					if(Grid.defaultStyle.img != null){
						ctx.drawImage(Grid.defaultStyle.img, this.x-this.l/2, this.y-this.l/2, this.l, this.l);
					}
					else{
						ctx.fillStyle = Grid.defaultStyle.colour[0];
						ctx.strokeStyle = Grid.defaultStyle.colour[1];
						ctx.lineWidth = Grid.defaultStyle.colour[2];
						if(Grid.defaultStyle.colour[0] != null){
							ctx.fillRect(this.x-this.l/2, this.y-this.l/2, this.l, this.l);
						}
						if(Grid.defaultStyle.colour[1] != null){
							ctx.strokeRect(this.x-this.l/2, this.y-this.l/2, this.l, this.l);
						}
					}
					ctx.translate(this.x, this.y);
					ctx.rotate(this.rot);
					if(this.style.img != null){
						ctx.drawImage(this.style.img, -this.l/2, -this.l/2, this.l, this.l);
					}
					else{
						ctx.fillStyle = this.style.colour[0];
						ctx.strokeStyle = this.style.colour[1];
						ctx.lineWidth = this.style.colour[2];
						if(this.style.colour[0] != null){
							ctx.fillRect(-this.l/2, -this.l/2, this.l, this.l);
						}
						if(this.style.colour[1] != null){
							ctx.strokeRect(-this.l/2, -this.l/2, this.l, this.l);
						}
					}
					ctx.rotate(-this.rot);
					ctx.translate(-this.x, -this.y);
					this.onLeftClick();
					this.onRightClick();
					this.onInteract();
					switch(this.type){
						case Grid.typeNum.drawingPad:
						this.displayDrawing();
						break;
					}
				}
				this.onCollideWithPlayer();
				this.onPlayerWithinGrid();
			}
			this.checkNeighbours();
			this.moveWithCamera();
		}
		this.moveWithCamera = ()=>{
			if(Camera.xpos != null && Camera.ypos != null){
				this.x = canvas.width/2 - Camera.xpos + this.xpos;
				this.y = canvas.height/2 - Camera.ypos + this.ypos;
			}
		}
		this.onCollideWithPlayer = ()=>{
			switch(this.state){
				case 1:
				if(Player.ypos >= this.ypos - this.l/2 && Player.ypos <= this.ypos + this.l/2){
					if(this.xpos - Player.xpos < this.l/2 + Player.l/2 && Player.xpos < this.xpos){
						Player.xpos -= (Player.l/2 + this.l/2) - Math.abs(Player.xpos - this.xpos) + 0.1;
						Player.xv = 0;
						Player.pushX = 0;
					}
					if(Player.xpos - this.xpos < this.l/2 + Player.l/2 && Player.xpos > this.xpos){
						Player.xpos += (Player.l/2 + this.l/2) - Math.abs(Player.xpos - this.xpos) + 0.1;
						Player.xv = 0;
						Player.pushX = 0;
					}
				}
				if(Player.xpos >= this.xpos - this.l/2 && Player.xpos <= this.xpos + this.l/2){
					if(this.ypos - Player.ypos < this.l/2 + Player.l/2 && Player.ypos < this.ypos){
						Player.ypos -= (Player.l/2 + this.l/2) - Math.abs(Player.ypos - this.ypos) + 0.1;
						Player.yv = 0;
						Player.pushY = 0;
					}
					if(Player.ypos - this.ypos < this.l/2 + Player.l/2 && Player.ypos > this.ypos){
						Player.ypos += (Player.l/2 + this.l/2) - Math.abs(Player.ypos - this.ypos) + 0.1;
						Player.yv = 0;
						Player.pushY = 0;
					}
				}
				var xDist, yDist, dist;
				var atCorner = false;
				if(Player.xpos < this.xpos - this.l/2 && Player.ypos < this.ypos - this.l/2){
					xDist = Player.xpos - (this.xpos - this.l/2);
					yDist = Player.ypos - (this.ypos - this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				else if(Player.xpos > this.xpos + this.l/2 && Player.ypos < this.ypos - this.l/2){
					xDist = Player.xpos - (this.xpos + this.l/2);
					yDist = Player.ypos - (this.ypos - this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				else if(Player.xpos < this.xpos - this.l/2 && Player.ypos > this.ypos + this.l/2){
					xDist = Player.xpos - (this.xpos - this.l/2);
					yDist = Player.ypos - (this.ypos + this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				else if(Player.xpos > this.xpos + this.l/2 && Player.ypos > this.ypos + this.l/2){
					xDist = Player.xpos - (this.xpos + this.l/2);
					yDist = Player.ypos - (this.ypos + this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				if(dist < Player.l/2 && atCorner){
					var angleRadians = Math.atan2(yDist, xDist);
					Player.xpos += Math.cos(angleRadians) * (Player.l/2 - dist);
					Player.ypos += Math.sin(angleRadians) * (Player.l/2 - dist);
				}
				break;
			}
		}
		this.onLeftClick = ()=>{
			if(mouse.down && this.checkMouse()){
				if(this.type != Grid.typeNum.air){
					this.initType(Grid.typeNum.air);
					this.rot = 0;
					this.updateOthersBlock();
				}
			}
		}
		this.onRightClick = ()=>{
			if(mouse.rightClick && this.checkMouse()){
				if(this.type == Grid.typeNum.air && (this.getAnyoneWithinGrid().length == 0 || this.getState(Player.selectedType.num) != 1)){
					this.initType(Player.selectedType.num);
					switch(Player.selectedType.num){
						case Grid.typeNum.gateClosed:
						this.rot = Math.atan2(Player.ypos - this.ypos, Player.xpos - this.xpos);
						if(this.rot >= Math.PI/4 && this.rot <= Math.PI/4*3){ //down
							this.rot = Math.PI/2;
						}
						else if(this.rot >= -Math.PI/4*3 && this.rot <= -Math.PI/4){ //up
							this.rot = -Math.PI/2;
						}
						else if((this.rot >= -Math.PI/4 && this.rot <= 0) || (this.rot >= 0 && this.rot <= Math.PI/4)){ //right
							this.rot = 0;
						}
						else if((this.rot >= Math.PI/4*3 && this.rot <= Math.PI) || (this.rot >= -Math.PI && this.rot <= -Math.PI/4*3)){ //left
							this.rot = Math.PI;
						}
						break;
					}
					this.updateOthersBlock(null);
				}
			}
		}
		this.onInteract = ()=>{
			switch(this.type){
				default:
				if(key[Player.controls[4]] && Player.canInteract && this.checkMouse()){
					switch(this.type){
						case Grid.typeNum.booster:
						this.rot += Math.PI/2;
						break;
						case Grid.typeNum.gateClosed:
						this.initType(Grid.typeNum.gateOpen);
						break;
						case Grid.typeNum.gateOpen:
						this.initType(Grid.typeNum.gateClosed);
						break;
					}
					switch(this.type){ //subject to changes
						default:
						this.updateOthersBlock(null);
						break;
					}
					Player.canInteract = false;
				}
				break;
				case Grid.typeNum.drawingPad:
				if(key[Player.controls[4]] && this.checkMouse()){
					var curXpos = mouse.x - canvas.width/2 + Camera.xpos;
					var curYpos = mouse.y - canvas.height/2 + Camera.ypos;
					if(Grid.curDrawingPad == null){
						Grid.curDrawingPad = this;
						var info = [curXpos, curYpos];
						this.drawInfo.push(info);
					}
					if(this.prevXpos != null && this.prevYpos != null){
						var xDist = curXpos - this.prevXpos;
						var yDist = curYpos - this.prevYpos;
						var dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
						if(dist >= this.lineWidth/2){ //OR !(this.prevXpos == curXpos && this.prevYpos == curYpos)
							var info = [curXpos, curYpos];
							this.drawInfo.push(info);
							if(this.prevXpos != curXpos && this.prevYpos != curYpos){
								this.prevXpos = curXpos;
								this.prevYpos = curYpos;
							}
						}
					}
					else{
						this.prevXpos = curXpos;
						this.prevYpos = curYpos;
					}
					//console.log(this.drawInfo);
				}
				break;
			}
		}
		this.displayDrawing = ()=>{
			for (var i = 0; i < this.drawingPosList.length; i++) {
				var _drawInfo = this.drawingPosList[i];
				for (var j = 0; j < _drawInfo.length; j++) {
					//var _posList = _drawInfo[j];
					if(j + 1 <= _drawInfo.length - 1){
						var x1 = canvas.width/2 - Camera.xpos + _drawInfo[j][0];
						var y1 = canvas.height/2 - Camera.ypos + _drawInfo[j][1];
						var x2 = canvas.width/2 - Camera.xpos + _drawInfo[j+1][0];
						var y2 = canvas.height/2 - Camera.ypos + _drawInfo[j+1][1];
						ctx.fillStyle = this.colour;
						ctx.strokeStyle = this.colour;
						ctx.lineWidth = this.lineWidth;
						ctx.beginPath();
						ctx.moveTo(x1, y1);
						ctx.lineTo(x2, y2);
						ctx.stroke();
						ctx.arc(x1, y1, this.lineWidth/2, 0, Math.PI*2);
						ctx.fill();
						ctx.arc(x2, y2, this.lineWidth/2, 0, Math.PI*2);
						ctx.fill();
						ctx.closePath();
					}
				}
			}
			Grid.onStopDrawing();
		}
		this.canUpdateOnPlayerWithinGrid = true;
		this.onPlayerWithinGrid = ()=>{
			if(this.checkPlayerWithinGrid() && this.canUpdateOnPlayerWithinGrid){
				switch(this.type){
					case Grid.typeNum.pressurePlate:
					this.isPowered = true;
					this.deactivateTimer.count = 0;
					this.deactivateTimer.trigger = false;
					this.updateOthersBlock({
						isPowered: this.isPowered,
					});
					//console.log('player within pressure plate');
					break;
				}
				this.canUpdateOnPlayerWithinGrid = false;
			}
			else if(!this.checkPlayerWithinGrid() && !this.canUpdateOnPlayerWithinGrid){
				switch(this.type){
					case Grid.typeNum.pressurePlate:
					this.deactivateTimer.count = 0;
					this.deactivateTimer.trigger = true;
					//console.log('player out of pressure plate');
					break;
				}
				this.canUpdateOnPlayerWithinGrid = true;
			}
			switch(this.type){
				case Grid.typeNum.pressurePlate:
				if(this.deactivateTimer.trigger){
					this.deactivateTimer.count += 1;
				}
				if(this.deactivateTimer.count >= this.deactivateTimer.delay){
					this.isPowered = false;
					this.updateOthersBlock({
						isPowered: this.isPowered,
					});
					this.deactivateTimer.count = 0;
					this.deactivateTimer.trigger = false;
				}
				break;
			}
		}
		this.canUpdateCheckNeighbours = true;
		this.checkNeighbours = ()=>{
			if(this.canUpdateCheckNeighbours){
				var poweredGridsCount = 0;
				for (var i = 0; i < this.neighbours.length; i++) {
					var _grid = this.neighbours[i];
					var breakLoop = false;
					if(_grid != undefined){
						switch(this.type){
							case Grid.typeNum.gateClosed:
							if(_grid.isPowered != null && _grid.isPowered != undefined){
								if(_grid.isPowered){
									this.initType(Grid.typeNum.gateOpen);
									this.updateOthersBlock(null);
									this.canUpdateCheckNeighbours = false;
									breakLoop = true;
								}
							}
							break;
							case Grid.typeNum.gateOpen:
							if(_grid.isPowered != null && _grid.isPowered != undefined){
								if(!_grid.isPowered){
									this.initType(Grid.typeNum.gateClosed);
									this.updateOthersBlock(null);
									this.canUpdateCheckNeighbours = false;
								}
							}
							break;
							case Grid.typeNum.wireUnpowered:
							switch(_grid.type){
								case Grid.typeNum.wireUnpowered:
								case Grid.typeNum.wirePowered:
								case Grid.typeNum.pressurePlate:
								case Grid.typeNum.gateClosed:
								case Grid.typeNum.gateOpen:
								var gridPos = Grid.getRelativePos(_grid.xpos, _grid.ypos);
								var xDist = gridPos.x - this.x;
								var yDist = gridPos.y - this.y;
								var dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
								var angleRadians = Math.atan2(yDist, xDist);
								ctx.fillStyle = this.colour;
								ctx.strokeStyle = this.colour;
								ctx.lineWidth = this.lineWidth;
								ctx.beginPath();
								ctx.moveTo(this.x, this.y);
								ctx.lineTo(this.x + Math.cos(angleRadians) * this.l/2, this.y + Math.sin(angleRadians) * this.l/2);
								ctx.stroke();
								ctx.closePath();
								ctx.beginPath();
								ctx.arc(this.x, this.y, this.lineWidth/2, 0, Math.PI*2);
								ctx.fill();
								ctx.closePath();
								break;
							}
							if(_grid.isPowered != null && _grid.isPowered != undefined){
								if(_grid.isPowered){
									poweredGridsCount += 1;
								}
							}
							break;
							case Grid.typeNum.wirePowered:
							switch(_grid.type){
								case Grid.typeNum.wireUnpowered:
								case Grid.typeNum.wirePowered:
								case Grid.typeNum.pressurePlate:
								case Grid.typeNum.gateClosed:
								case Grid.typeNum.gateOpen:
								var gridPos = Grid.getRelativePos(_grid.xpos, _grid.ypos);
								var xDist = gridPos.x - this.x;
								var yDist = gridPos.y - this.y;
								var dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
								var angleRadians = Math.atan2(yDist, xDist);
								ctx.fillStyle = this.colour;
								ctx.strokeStyle = this.colour;
								ctx.lineWidth = this.lineWidth;
								ctx.beginPath();
								ctx.moveTo(this.x, this.y);
								ctx.lineTo(this.x + Math.cos(angleRadians) * this.l/2, this.y + Math.sin(angleRadians) * this.l/2);
								ctx.stroke();
								ctx.closePath();
								ctx.beginPath();
								ctx.arc(this.x, this.y, this.lineWidth/2, 0, Math.PI*2);
								ctx.fill();
								ctx.closePath();
								break;
							}
							if(_grid.isPowered != null && _grid.isPowered != undefined){
								if(_grid.isPowered){
									poweredGridsCount += 1;
								}
							}
							break;
						}
					}
					if(breakLoop){
						break;
					}
				}
				switch(this.type){
					case Grid.typeNum.wireUnpowered:
					if(poweredGridsCount > 0){
						this.initType(Grid.typeNum.wirePowered);
						this.updateOthersBlock(null);
					}
					break;
					case Grid.typeNum.wirePowered:
					//console.log(poweredGridsCount);
					if(poweredGridsCount <= 0){
						this.initType(Grid.typeNum.wireUnpowered);
						this.updateOthersBlock(null);
					}
					break;
				}
			}
		}
		this.updateOthersBlock = (extra)=>{
			socket.emit('updateBlock', {
				index: this.index,
				type: this.type,
				rot: this.rot,
				extra: extra,
			});
		}
		this.checkMouse = ()=>{
			if(mouse.x > this.x - this.l/2 && mouse.x < this.x + this.l/2 && mouse.y > this.y - this.l/2 && mouse.y < this.y + this.l/2){
				return true;
			}
			else{
				return false;
			}
		}
		this.checkPlayerWithinGrid = ()=>{
			var isWithinGrid = false;
			if(Player.ypos >= this.ypos - this.l/2 && Player.ypos <= this.ypos + this.l/2){
				if((this.xpos - Player.xpos < this.l/2 + Player.l/2 && Player.xpos < this.xpos) || (Player.xpos - this.xpos < this.l/2 + Player.l/2 && Player.xpos > this.xpos)){
					isWithinGrid = true;
				}
			}
			if(Player.xpos >= this.xpos - this.l/2 && Player.xpos <= this.xpos + this.l/2){
				if((this.ypos - Player.ypos < this.l/2 + Player.l/2 && Player.ypos < this.ypos) || (Player.ypos - this.ypos < this.l/2 + Player.l/2 && Player.ypos > this.ypos)){
					isWithinGrid = true;
				}
			}
			var xDist, yDist, dist;
			var atCorner = false;
			if(Player.xpos < this.xpos - this.l/2 && Player.ypos < this.ypos - this.l/2){
				xDist = Player.xpos - (this.xpos - this.l/2);
				yDist = Player.ypos - (this.ypos - this.l/2);
				dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
				atCorner = true;
			}
			else if(Player.xpos > this.xpos + this.l/2 && Player.ypos < this.ypos - this.l/2){
				xDist = Player.xpos - (this.xpos + this.l/2);
				yDist = Player.ypos - (this.ypos - this.l/2);
				dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
				atCorner = true;
			}
			else if(Player.xpos < this.xpos - this.l/2 && Player.ypos > this.ypos + this.l/2){
				xDist = Player.xpos - (this.xpos - this.l/2);
				yDist = Player.ypos - (this.ypos + this.l/2);
				dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
				atCorner = true;
			}
			else if(Player.xpos > this.xpos + this.l/2 && Player.ypos > this.ypos + this.l/2){
				xDist = Player.xpos - (this.xpos + this.l/2);
				yDist = Player.ypos - (this.ypos + this.l/2);
				dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
				atCorner = true;
			}
			if(dist < Player.l/2 && atCorner){
				isWithinGrid = true;
			}
			return isWithinGrid;
		}
		this.getAnyoneWithinGrid = ()=>{
			var peopleInGrid = [];
			for(var id in Others.info){
				var _info = Others.info[id];
				var isWithinGrid = false;
				if(_info.ypos >= this.ypos - this.l/2 && _info.ypos <= this.ypos + this.l/2){
					if((this.xpos - _info.xpos < this.l/2 + _info.l/2 && _info.xpos < this.xpos) || (_info.xpos - this.xpos < this.l/2 + _info.l/2 && _info.xpos > this.xpos)){
						isWithinGrid = true;
					}
				}
				if(_info.xpos >= this.xpos - this.l/2 && _info.xpos <= this.xpos + this.l/2){
					if((this.ypos - _info.ypos < this.l/2 + _info.l/2 && _info.ypos < this.ypos) || (_info.ypos - this.ypos < this.l/2 + _info.l/2 && _info.ypos > this.ypos)){
						isWithinGrid = true;
					}
				}
				var xDist, yDist, dist;
				var atCorner = false;
				if(_info.xpos < this.xpos - this.l/2 && _info.ypos < this.ypos - this.l/2){
					xDist = _info.xpos - (this.xpos - this.l/2);
					yDist = _info.ypos - (this.ypos - this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				else if(_info.xpos > this.xpos + this.l/2 && _info.ypos < this.ypos - this.l/2){
					xDist = _info.xpos - (this.xpos + this.l/2);
					yDist = _info.ypos - (this.ypos - this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				else if(_info.xpos < this.xpos - this.l/2 && _info.ypos > this.ypos + this.l/2){
					xDist = _info.xpos - (this.xpos - this.l/2);
					yDist = _info.ypos - (this.ypos + this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				else if(_info.xpos > this.xpos + this.l/2 && _info.ypos > this.ypos + this.l/2){
					xDist = _info.xpos - (this.xpos + this.l/2);
					yDist = _info.ypos - (this.ypos + this.l/2);
					dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
					atCorner = true;
				}
				if(dist < _info.l/2 && atCorner){
					isWithinGrid = true;
				}
				if(isWithinGrid){
					peopleInGrid.push(_info);
				}
			}
			return peopleInGrid;
		}
		this.checkWithinScreen = ()=>{
			if(this.x < -this.l/2 || this.x > canvas.width+this.l/2 || this.y < -this.l/2 || this.y > canvas.height+this.l/2){
				return false;
			}
			else{
				return true;
			}
		}
	}
}
socket.on('updateOthersBlock', data=>{
	for (var i = 0; i < Grid.list.length; i++) {
		for (var j = 0; j < Grid.list[i].length; j++) {
			var _grid = Grid.list[i][j];
			if(_grid.index[0] == data.index[0] && _grid.index[1] == data.index[1]){
				_grid.initType(data.type);
				_grid.rot = data.rot;
				for (var k = 0; k < _grid.neighbours.length; k++) {
					if(_grid.neighbours[k] != undefined){
						if(!_grid.neighbours[k].canUpdateCheckNeighbours){
							_grid.neighbours[k].canUpdateCheckNeighbours = true;
						}
					}
				}
				switch(data.type){
					case Grid.typeNum.pressurePlate:
					if(data.extra != null){
						_grid.isPowered = data.extra.isPowered;
						if(!data.extra.isPowered){
							_grid.canUpdateOnPlayerWithinGrid = true;
						}
					}
					break;
					case Grid.typeNum.drawingPad:
					if(data.extra != null){
						_grid.drawingPosList = data.extra.drawingPosList;
					}
					break;
				}
			}
		}
	}
	//console.log('update other blocks');
});
class Player{
	static controls = [87, 83, 65, 68, 69]; // up, down, left, right, interact
	static xpos = null;
	static ypos = null;
	static xv = 0;
	static yv = 0;
	static pushX = 0;
	static pushY = 0;
	static l = 40;
	static rot = 0;
	static incSpeed = 0.5; //0.5
	static maxSpeed = 5; //5
	static initialIncSpeed = this.incSpeed;
	static initialMaxSpeed = this.maxSpeed;
	static isSlowed = false; //false
	static isHidden = false; //false
	static canInteract = true;
	static style = {
		img: null,
		colour: ['red', 'black', 5],
	};
	static init(){
		var imgList = [
			document.getElementById('playerRed'), 
			document.getElementById('playerBlue'),
			document.getElementById('playerYellow'),
		];
		this.style.img = imgList[Math.floor(Math.random() * imgList.length)];
		this.xpos = (Grid.list[0].length * Grid.l)/2;
		this.ypos = (Grid.list.length * Grid.l)/2;
		this.selectedType.num = Grid.typeNum.wall;
		this.initSelectedTypePos();
	}
	static create(){
		if(document.visibilityState == 'visible'){
			ctx.shadowColor = 'black';
			ctx.shadowBlur = 15;
			if(Player.isHidden){
				ctx.globalAlpha = 0.5;
			}
			ctx.translate(this.x, this.y);
			ctx.rotate(this.rot);
			if(this.style.img != null){
				ctx.drawImage(this.style.img, -this.l/2, -this.l/2, this.l, this.l);
			}
			else{
				ctx.fillStyle = this.style.colour[0];
				ctx.strokeStyle = this.style.colour[1];
				ctx.lineWidth = this.style.colour[2];
				ctx.beginPath();
				ctx.arc(0, 0, this.l/2, 0, Math.PI*2);
				if(this.style.colour[0] != null){
					ctx.fill();
				}
				if(this.style.colour[1] != null){
					ctx.stroke();
				}
				ctx.closePath();
			}
			ctx.rotate(-this.rot);
			ctx.translate(-this.x, -this.y);
			ctx.shadowBlur = 0;
			ctx.globalAlpha = 1;
		}
		this.moveWithCamera();
		this.move();
		this.onCollideWithOther();
		this.lookAtCursor();
		this.sendPlayerInfo();
	}
	static moveWithCamera(){
		if(Camera.xpos != null && Camera.ypos != null){
			this.x = canvas.width/2 - Camera.xpos + this.xpos;
			this.y = canvas.height/2 - Camera.ypos + this.ypos;
		}
	}
	static move(){
		this.xpos += this.xv + this.pushX;
		this.ypos += this.yv + this.pushY;
		if(key[this.controls[0]]){
			this.yv -= this.incSpeed;
		}
		if(key[this.controls[1]]){
			this.yv += this.incSpeed;
		}
		if(key[this.controls[2]]){
			this.xv -= this.incSpeed;
		}
		if(key[this.controls[3]]){
			this.xv += this.incSpeed;
		}

		if(this.xv > this.maxSpeed){
			this.xv = this.maxSpeed;
		}
		else if(this.xv < -this.maxSpeed){
			this.xv = -this.maxSpeed;
		}
		if(this.yv > this.maxSpeed){
			this.yv = this.maxSpeed;
		}
		else if(this.yv < -this.maxSpeed){
			this.yv = -this.maxSpeed;
		}
		var stopNum = 4;
		if((!key[this.controls[2]] && !key[this.controls[3]]) && (this.xv > 0 || this.xv < 0)){
			this.xv -= this.xv/stopNum;
		}
		if(!key[this.controls[0]] && !key[this.controls[1]] && (this.yv > 0 || this.yv < 0)){
			this.yv -= this.yv/stopNum;
		}
		var minNum = 0.05;
		if(this.xv < minNum && this.xv > -minNum){
			this.xv = 0;
		}
		if(this.yv < minNum && this.yv > -minNum){
			this.yv = 0;
		}
		var stopNum = 10;
		if(Player.isSlowed){
			stopNum = 3;
		}
		if(this.pushX > 0 || this.pushX < 0){
			this.pushX -= this.pushX/stopNum;
		}
		if(this.pushY > 0 || this.pushY < 0){
			this.pushY -= this.pushY/stopNum;
		}
		var minNum = 0.05;
		if(this.pushX < minNum && this.pushX > -minNum){
			this.pushX = 0;
		}
		if(this.pushY < minNum && this.pushY > -minNum){
			this.pushY = 0;
		}
		if(this.xpos < 0){
			this.xpos = 0;
		}
		else if(this.xpos > (Grid.l * (Grid.list[0].length-1))){
			this.xpos = (Grid.l * (Grid.list[0].length-1));
		}
		if(this.ypos < 0){
			this.ypos = 0;
		}
		else if(this.ypos > (Grid.l * (Grid.list.length-1))){
			this.ypos = (Grid.l * (Grid.list.length-1));
		}
	}
	static onCollideWithOther(){
		for(var id in Others.info){
			if(Client.id != id){
				var _info = Others.info[id];
				var xDist = this.xpos - _info.xpos;
				var yDist = this.ypos - _info.ypos;
				var dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
				if(dist < this.l/2 + _info.l/2){
					var angleRadians = Math.atan2(yDist, xDist);
					this.xpos += Math.cos(angleRadians) * ((this.l/2 + _info.l/2) - dist);
					this.ypos += Math.sin(angleRadians) * ((this.l/2 + _info.l/2) - dist);
				}
			}
		}
	}
	static lookAtCursor(){
		this.rot = Math.atan2(mouse.y - this.y, mouse.x - this.x);
	}
	static sendPlayerInfo(){
		socket.emit('updatePlayerInfo', {
			id: Client.id,
			info: {
				xpos: this.xpos,
				ypos: this.ypos,
				l: this.l,
				rot: this.rot,
				imgId: this.style.img.id,
				isHidden: this.isHidden,
			},
		});
	}
	static selectedType = {
		num: null,
		l: 100,
		x: 0,
		y: 0,
		margin: 20,
	};
	static initSelectedTypePos(){
		this.selectedType.x = canvas.width - this.selectedType.l/2 - this.selectedType.margin;
		this.selectedType.y = this.selectedType.l/2 + this.selectedType.margin;
	}
	static changeSelectedType(change){
		do{
			this.selectedType.num += change;
			if(this.selectedType.num < 0){
				this.selectedType.num = Grid.typeList.length-1;
			}
			else if(this.selectedType.num > Grid.typeList.length-1){
				this.selectedType.num = 0;
			}
		}
		while(Grid.typeList[this.selectedType.num][1] != 1);
	}
	static showSelectedType(){
		var style = {
			img: null,
			colour: [null, 'black', 5],
		}
		for(var typeName in Grid.typeNum){
			if(Grid.typeNum[typeName] == this.selectedType.num){
				style.img = document.getElementById(typeName);
				break;
			}
		}
		if(this.selectedType.num != null){
			if(style.img != null){
				ctx.drawImage(style.img, this.selectedType.x-this.selectedType.l/2, this.selectedType.y-this.selectedType.l/2, this.selectedType.l, this.selectedType.l);
			}
			else{
				ctx.fillStyle = style.colour[0];
				ctx.strokeStyle = style.colour[1];
				ctx.lineWidth = style.colour[2];
				if(style.colour[0] != null){
					ctx.fillRect(this.selectedType.x-this.selectedType.l/2, this.selectedType.y-this.selectedType.l/2, this.selectedType.l, this.selectedType.l);
				}
				if(style.colour[1] != null){
					ctx.strokeRect(this.selectedType.x-this.selectedType.l/2, this.selectedType.y-this.selectedType.l/2, this.selectedType.l, this.selectedType.l);
				}
			}
		}
	}
	static showCoords(){
		var coords = Grid.getCoords(this.xpos, this.ypos);
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 1.5;
		ctx.font = `40px Helvetica`;
		ctx.fillText(`x: ${Math.round(coords.x * 10)/10} y: ${Math.round(coords.y * 10)/10}`, 50, 50);
		ctx.strokeText(`x: ${Math.round(coords.x * 10)/10} y: ${Math.round(coords.y * 10)/10}`, 50, 50);
	}
}
class Others{
	static l = 40;
	static style = {
		img: null,
		colour: ['blue', 'white', 5],
	}
	static info = {};
	static show(){
		if(document.visibilityState == 'hidden')return;
		for(var id in this.info){
			if(Client.id != id){
				var _info = this.info[id];
				var pos = Grid.getRelativePos(_info.xpos, _info.ypos);
				var options = {
					x: pos.x,
					y: pos.y,
					l: _info.l,
					rot: _info.rot,
					style: {
						img: document.getElementById(_info.imgId),
						colour: ['blue', 'white', 5],
					},
				}
				if(!_info.isHidden){
					this.draw(options);
				}
			}
		}
	}
	static draw(options){
		var x = options.x;
		var y = options.y;
		var l = options.l;
		var rot = options.rot;
		var style = options.style;
		ctx.shadowColor = 'black';
		ctx.shadowBlur = 15;
		ctx.translate(x, y);
		ctx.rotate(rot);
		if(style.img != null){
			ctx.drawImage(style.img, -l/2, -l/2, l, l);
		}
		else{
			ctx.fillStyle = style.colour[0];
			ctx.strokeStyle = style.colour[1];
			ctx.lineWidth = style.colour[2];
			ctx.beginPath();
			ctx.arc(0, 0, l/2, 0, Math.PI*2);
			if(style.colour[0] != null){
				ctx.fill();
			}
			if(style.colour[1] != null){
				ctx.stroke();
			}
			ctx.closePath();
		}
		ctx.rotate(-rot);
		ctx.translate(-x, -y);
		ctx.shadowBlur = 0;
	}
}

socket.on('updateOthersInfo', info=>{
	Others.info = info;
});

function background(colour){
	if(document.visibilityState == 'visible'){
		ctx.fillStyle = colour;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
}
function loop(){
	background('rgb(135, 206, 235)');
	Camera.lockOnPlayer();
	Grid.create();
	Player.create();
	Others.show();
	Player.showSelectedType();
	Player.showCoords();
}
socket.on('loopGame', ()=>{
	loop();
});
