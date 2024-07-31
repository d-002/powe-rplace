let socket = io();

let canvas, ctx;
let scrW, scrH;

// options loaded from user save
let zoom = 1, pos = [0, 0], currentColor = 1;
let size = 50;

// pixels pre-placed locally, waiting for server to accept or overrule
let placedLocally = {}; // hash: [x, y, prev col]

let localGrid = [];

function updateSettings() {
	scrW = window.innerWidth;
	scrH = window.innerHeight;
	canvas.width = scrW;
	canvas.height = scrH;
}

function drawPixel(x, y, col) {
	localGrid[y][x] = col;
	ctx.fillStyle = colors[col];
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
	if (x < 0 || x >= W || y < 0 || y >= H) return;

	placedLocally[hash] = [x, y, localGrid[y][x]];
	drawPixel(x, y, currentColor);
	updateLocalStorage();

	socket.emit("placePixel", x+" "+y+" "+currentColor+" "+hash);
}

function hashPixel(x, y, col) {
	return ((x << col) + (y*123 << col+10)) & 0xffff;
}

socket.on("mapUpdate", data => {
	applyUpdate(data, drawPixel, grid => { localGrid = grid });
	updateLocalStorage();
	updateAllCanvas();
});

socket.on("pixelFeedback", data => {
	// the last byte is for the error, the rest is the pixel hash
	const err = data & 0xff;
	const hash = data >> 8;

	const local = placedLocally[hash];
	if (local == null) return;
	const [x, y, col] = local;

	if (err != 0) {
		// revert placement
		drawPixel(x, y, col);
		updateLocalStorage();
	}
});

function updateLocalStorage() {
	localStorage.setItem("map", encodeMap(localGrid));
}

function loadLocalStorage() {
	let item = localStorage.getItem("map");
	if (item == null) console.warn("No map found in local storage");
	else {
		try {
			localGrid = decodeMap(item);
			return;
		}
		catch {
			console.warn("Error loading map from local storage");
		}
	}

	// loading map failed
	socket.emit("help");
}

window.onload = () => {
	canvas = document.getElementById("grid");
	ctx = canvas.getContext("2d");
	updateSettings();
	loadLocalStorage();

	canvas.addEventListener("click", click);

	document.addEventListener("keydown", () => { currentColor = (currentColor+1) % colors.length });
}
