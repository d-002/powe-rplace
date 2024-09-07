let W, H, ctx;
let fps = 10;
let size = 20;
let window, canvas;
let interval;

let canvMult;
let points;
let trails;

let lastResize = 0;
let sizeOk = true;

class Point {
    constructor() {
        this.setPos();

        // random spawn delay in the first few seconds
        this.spawn = Date.now()+Math.random()*5000;

        this.prevA = 1;
        this.prevRising = false;
    }

    setPos() {
        this.x = parseInt(Math.random()*W/size);
        this.y = parseInt(Math.random()*H/size);
    }

    update() {
        const a = this.getAlpha();
        const rising = a > this.prevA;
        if (rising && !this.prevRising) this.setPos();

        this.prevA = a;
        this.prevRising = rising;
    }

    getAlpha() {
        const t = Date.now()-this.spawn;
        if (t < 0) return 0;
        return 0.5 - Math.cos(t/1000)/2;
    }
}

class Trail extends Point {
    constructor() {
        super();

        this.length = parseInt(Math.random()*5) + 15;

        this.dx = (Math.round(Math.random())*2 - 1);

        this.trail = []; // previous points

        this.height = Math.round(Math.random()*2);
        this.offset = [];
        for (let i = 0; i < this.height*2 + 1; i++) {
            this.offset.push(Math.round(Math.random()*2));
        }
    }

    update(f) {
        const modX = Math.ceil(W/size);
        this.x += this.dx;
        let off = false;
        if (this.x < -2) {
            off = true;
            this.x = modX+2;
        }
        else if (this.x >= modX+2) {
            off = true;
            this.x = -2;
        }
        if (off) this.y = parseInt(Math.random()*H/size); // change height when offscreen
        this.y = this.y%(Math.ceil(H/size)); // in case the screen gets resized

        // reached a new tile: edit the trail
        if (this.trail.length == 0 || this.trail.slice(-1)[0][0] != this.x) {
            this.trail.push([this.x, this.y]);
        }

        if (this.trail.length > this.length) {
            const [x, y, _] = this.trail.shift();
            f(x, y);
        }
    }
}

let mod = (x, m) => (x%m + m) % m;

let alpha = x => Math.pow(2.25 * Math.sqrt(x) * (Math.cos(Math.PI*x)/2 + 0.5), 2);

function colFromPos(x, y) {
    const g = x*size/W*255;
    const r = 255-g;
    const b = y*size/H*255;
    ctx.fillStyle = "rgb("+r+", "+g+", "+b+")";
}

function _start() {
    points = [];
    trails = [];
    for (let i = 0; i < 20; i++) points.push(new Point());
    for (let i = 0; i < 20; i++) trails.push(new Trail());
}

function _animate() {
    // resize, but add a cooldown
    if (!sizeOk && Date.now()-lastResize > 100) {
        sizeOk = true;
        animResize();
    }

    // make sure the points start from the background color
    ctx.fillStyle = "white";
    ctx.globalAlpha = 1;
    points.forEach(point => {
        ctx.fillRect(point.x*size, point.y*size, size-1, size-1)
        point.update();
    });

    // move trails and fill end of trails with background color
    trails.forEach(trail => {
        trail.update((x, y) => ctx.fillRect(x*size, y*size, size-1, size-1));

        for (let i = 0, len = trail.trail.length; i < len; i++) {
            const [x, _y, col] = trail.trail[i];
            let j = 0;
            for (let y = _y-trail.height, stop = _y+trail.height; y <= stop; y++) {
                ctx.fillRect((x+trail.offset[j++])*size, y*size, size-1, size-1);
            }
        }
    });

    // draw trails with alpha, to be able to stack them
    trails.forEach(trail => {
        const a1 = trail.getAlpha();
        if (a1 == 0) return;

        for (let i = 0, len = trail.trail.length; i < len; i++) {
            const a2 = alpha(1 - i/trail.length);
            const [x, _y, col] = trail.trail[i];

            if (x < 0 || x >= canvMult[0].length) continue;

            let j = 0;
            for (let y = _y-trail.height; y <= _y+trail.height; y++) {
                const offset = trail.offset[j];

                if (y < 0 || y >= canvMult.length) continue;

                colFromPos(x, y);
                ctx.globalAlpha = a1*a2*canvMult[y][x];
                ctx.fillRect((x+trail.offset[j++])*size, y*size, size-1, size-1);
                j++;
            }
        }
    });

    // draw the points on top
    points.forEach(point => {
        colFromPos(point.x, point.y);
        ctx.globalAlpha = point.getAlpha() * 0.5;
        ctx.fillRect(point.x*size, point.y*size, size-1, size-1);
    });
}

function resized() {
    lastResize = Date.now();
    sizeOk = false;
}

function animResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    canvMult = [];
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "white";

    for (let y = 0; y <= H/size; y++) {
        canvMult.push([]);
        for (let x = 0; x <= W/size; x++) {
            canvMult[y].push(Math.random()*0.6 + 0.2);
            ctx.fillRect(x*size, y*size, size-1, size-1);
        }
    }
}

export function animate(_window, _canvas) {
    window = _window;
    canvas = _canvas;

    window.addEventListener("resize", resized);
    ctx = canvas.getContext("2d");
    animResize();

    _start();
    interval = window.setInterval(_animate, 1000/fps);
}

export function stopAnimation() {
    window.clearInterval(interval);
}
