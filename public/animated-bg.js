let W, H, ctx;
let fps;
let size = 20;
let window, canvas;
let interval;

let points;

class Point {
	constructor() {
		this.x = Math.random()*W;
		this.y = Math.random()*H;

		// random spawn delay in the first few seconds
		this.spawn = Date.now()+Math.random()*2000;

		this.pulseSpeed = Math.random()*0.5 + 0.2;

		const a = Math.random()*2*Math.PI;
		const speed = Math.random()*100 + 50;
		this.dx = Math.cos(a)*speed/fps;
		this.dy = Math.sin(a)*speed/fps;

		this.col = colors[parseInt(Math.random()*colors.length)];
		this.colObj = Vec3.fromColor(this.col);
	}

	update() {
		this.x = mod(this.x + this.dx, W);
		this.y = mod(this.y + this.dy, H);
	}
}

class Vec3 {
	constructor(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
	}

	lerp(col, t) {
		this.r += (col.r-this.r)*t;
		this.g += (col.g-this.g)*t;
		this.b += (col.b-this.b)*t;
	}

	static fromColor(col) {
		let r, g, b;
		if (col.length == 7) {
			r = parseInt(col.substring(1), 16)/256;
			g = parseInt(col.substring(3, 5), 16)/256;
			b = parseInt(col.substring(5), 16)/256;
		}
		else if (col.length == 4) {
			r = parseInt(col[1], 16)/16;
			g = parseInt(col[2], 16)/16;
			b = parseInt(col[3], 16)/16;
		}
		else console.log("Unparsable color: "+col);

		return new Vec3(r, g, b);
	}

	toColor() {
		return "rgb("+this.r*256+", "+this.g*256+", "+this.b*256+")";
	}
}

let mod = (x, m) => (x%m + m) % m;

function _start() {
	points = [];
	for (let i = 0; i < 5; i++) points.push(new Point());
}

function _animate() {
	points.forEach(point => point.update());

	ctx.clearRect(0, 0, W, H);

	const value = 255/256;
	const thres = 25000;

	for (let x = 0; x <= W/size; x++)
	for (let y = 0; y <= H/size; y++) {
		const col = new Vec3(value, value, value);
		points.forEach(point => {
			const dx = point.x - x*size;
			const dy = point.y - y*size;
			const d2 = dx*dx + dy*dy;

			if (d2 < thres) col.lerp(point.colObj, 1 - d2/thres);
		});

		ctx.fillStyle = col.toColor();
		ctx.fillRect(x*size, y*size, size-1, size-1);
	}
}

function animResize() {
	W = window.innerWidth;
	H = window.innerHeight;
	canvas.width = W;
	canvas.height = H;
}

export function animate(_window, _canvas, _fps) {
	window = _window;
	canvas = _canvas;
	fps = _fps;

	window.addEventListener("resize", animResize);
	animResize();
	ctx = canvas.getContext("2d");

	_start();
	interval = window.setInterval(_animate, 1000/fps);
}
