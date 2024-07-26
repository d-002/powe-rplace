let socket = io();

let canvas, ctx;
let W = 30, H = 30, size = 50;
let scrW, scrH;

const colors = ['white', 'red', 'green', 'blue', 'black'];
let currentColor = 1;

// pixels pre-placed locally, waiting for server to accept or overrule
let placedLocally = {}; // hash: [x, y, prev col]

let localGrid = [];
for (let y = 0; y < H; y++) {
	localGrid.push([]);
	for (let x = 0; x < W; x++) localGrid[y].push(0);
}

function updateSettings() {
	scrW = window.innerWidth;
	scrH = window.innerHeight;
	canvas.width = scrW;
	canvas.height = scrH;
}

function drawPixel(x, y, colI) {
	localGrid[y][x] = colI;
	ctx.fillStyle = colors[colI];
	const _x = x*size, _y = y*size;
	ctx.fillRect(_x, _y, size-1, size-1);
}

function updateAllCanvas() {
	ctx.fillStyle = 'gray';
	ctx.fillRect(0, 0, scrW, scrH);

	for (let x = 0; x < W; x++)
		for (let y = 0; y < H; y++)
			drawPixel(x, y, localGrid[y][x]);
}

function click(evt) {
	const x = parseInt(evt.x/size);
	const y = parseInt(evt.y/size);
	const hash = hashPixel(x, y, currentColor);

	placedLocally[hash] = [x, y, localGrid[y][x]];
	drawPixel(x, y, currentColor);

	socket.emit("placePixel", x+" "+y+" "+currentColor+" "+hash);
}

function hashPixel(x, y, col) {
	return ((x << col) + (y*123 << col+10)) & 0xffff;
}

socket.on("pixelFeedback", (data) => {
	// the last byte is for the error, the rest is the pixel hash
	const err = data & 0xff;
	const hash = data >> 8;

	const local = placedLocally[hash];
	if (local == null) return;
	const [x, y, col] = local;

	if (err != 0) drawPixel(x, y, col); // revert placement
});

function init() {
	canvas = document.getElementById("grid");
	ctx = canvas.getContext("2d");
	updateSettings();

	updateAllCanvas();

	canvas.addEventListener("click", click);
}
