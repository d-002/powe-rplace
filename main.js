let canvas, ctx;
let W = 30, H = 30, size = 50;
let scrW, scrH;

let colors = ['white', 'red', 'green', 'blue', 'black'];
let currentColor = 1;

let cachedGrid = [];
for (let y = 0; y < W; y++) {
	cachedGrid.push([]);
	for (let x = 0; x < H; x++) cachedGrid[y].push(0);
}

function updateSettings() {
	scrW = window.innerWidth;
	scrH = window.innerHeight;
	canvas.width = scrW;
	canvas.height = scrH;
}

function drawPixel(x, y, colI) {
	ctx.fillStyle = colors[colI];
	let _x = x*size, _y = y*size;
	ctx.fillRect(_x, _y, size-1, size-1);
}

function updateAllCanvas() {
	ctx.fillStyle = 'gray';
	ctx.fillRect(0, 0, scrW, scrH);

	for (let x = 0; x < W; x++)
		for (let y = 0; y < H; y++) {
			drawPixel(x, y, cachedGrid[y][x]);
		}
}

function click(evt) {
	let x = parseInt(evt.x/size);
	let y = parseInt(evt.y/size);

	cachedGrid[y][x] = currentColor;
	drawPixel(x, y, currentColor);
}

function init() {
	canvas = document.getElementById("grid");
	ctx = canvas.getContext("2d");
	updateSettings();

	updateAllCanvas();

	canvas.addEventListener("click", click);
}
