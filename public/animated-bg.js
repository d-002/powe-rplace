let W, H, ctx;
let fps = 5;
let size = 20;
let window, canvas;
let interval;

let canvMult;
let points;

class Point {
	constructor(x) {
		this.x = Math.random()*W;
		this.y = parseInt(Math.random()*H/size)*size;

		// random spawn delay in the first few seconds
		this.spawn = Date.now()+Math.random()*2000;

		this.length = parseInt(Math.random()*5) + 10;

		this.dx = (parseInt(Math.random()*2)*2 - 1) * 100 / fps;

		this.trail = []; // previous points

		this.col = Math.random();
		this.dcol = (Math.random()*0.05 + 0.1) / fps;

		this.height = parseInt(Math.random()*2 + 2);
		this.offset = [];
		for (let i = 0; i < this.height*2 + 1; i++) {
			this.offset.push(Math.round(Math.random()*2));
		}
	}

	update(f) {
		this.x = mod(this.x + this.dx, W);
		this.y = this.y%H; // in case the screen gets resized
		this.col = (this.col+this.dcol)%1;

		this.ix = parseInt(this.x/size);

		// reached a new tile: edit the trail
		if (this.trail.length == 0 || this.trail.slice(-1)[0][0] != this.ix) {
			this.trail.push([this.ix, parseInt(this.y/size)]);
		}

		if (this.trail.length > this.length) {
			const [x, y, _] = this.trail.shift();
			f(x, y);
		}
	}
}

let mod = (x, m) => (x%m + m) % m;

let alpha = x => Math.pow(2.25 * Math.sqrt(x) * (Math.cos(Math.PI*x)/2 + 0.5), 2);

function getCol(t) {
	// convert HSL (t, 1, 0.5) into RGB

	t *= 360;
	const X = (1 - Math.abs(t/60%2 - 1)) * 255;
	let r, g, b;

	if (t < 60) [r, g, b] = [255, X, 0];
	else if (t < 120) [r, g, b] = [X, 255, 0];
	else if (t < 180) [r, g, b] = [0, 255, X];
	else if (t < 240) [r, g, b] = [0, X, 255];
	else if (t < 300) [r, g, b] = [X, 0, 255];
	else [r, g, b] = [255, 0, X];

	return "rgb("+r+", "+g+", "+b+")";
}

function _start() {
	points = [];
	for (let i = 0; i < 20; i++) points.push(new Point(i));
}

function _animate() {
	// move points and fill end of trails with background color
	points.forEach(point => {
		ctx.fillStyle = "white";
		ctx.globalAlpha = 1;
		point.update((x, y) => ctx.fillRect(x*size, y*size, size-1, size-1));

		for (let i = 0; i < point.trail.length; i++) {
			const [x, _y, col] = point.trail[i];
			let j = 0;
			for (let y = _y-point.height; y <= _y+point.height; y++) {
				ctx.fillStyle = "white";
				ctx.globalAlpha = 1;
				ctx.fillRect((x+point.offset[j++])*size, y*size, size-1, size-1);
			}
		}
	});

	points.forEach(point => {
		for (let i = 0; i < point.trail.length; i++) {
			const [x, _y] = point.trail[i];
			let j = 0;
			for (let y = _y-point.height; y <= _y+point.height; y++) {
				const offset = point.offset[j];

				ctx.fillStyle = getCol(point.col+point.dcol*j+offset);
				ctx.globalAlpha = alpha(1 - i/point.length) * canvMult[x][y];
				ctx.fillRect((x+offset)*size, y*size, size-1, size-1);
				j++;
			}
		}
	});

	ctx.globalAlpha = 1;
}

function animResize() {
	W = window.innerWidth;
	H = window.innerHeight;
	canvas.width = W;
	canvas.height = H;

	canvMult = [];
	ctx.fillStyle = "white";

	for (let x = 0; x <= W/size; x++) {
		canvMult.push([]);
		for (let y = 0; y <= H/size; y++) {
			canvMult[x].push(Math.random()*0.3 + 0.7);
			ctx.fillRect(x*size, y*size, size-1, size-1);
		}
	}
}

export function animate(_window, _canvas) {
	window = _window;
	canvas = _canvas;

	window.addEventListener("resize", animResize);
	ctx = canvas.getContext("2d");
	animResize();

	_start();
	interval = window.setInterval(_animate, 1000/fps);
}
