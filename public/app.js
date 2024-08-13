let ctx;
let cW, cH;

let dom = {
    canvas: null,
    colors: null,
    info: null
}

let interval;

let chunkSystem;
let movement;

let fps = 60;

const cSize = 16;
class Chunk {
    static size = 16;

    // a chunk is a wrapper around a byte array for image data
    // the size this array is cSize*scale px wide when viewed at a certain zoom,
    // scaled up or down depending on the actual zoom
    // the zoom used should be a power of 2
    constructor(x, y, zoom) {
        this.ready = false;

        this.x = x;
        this.y = y;
        this.zoom = zoom;
    }

    static toImage(buffer) {
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
        return image;
    }

    init() {
        const pixSize = scale*this.zoom;
        const width = scale*Chunk.size;
        const number = Math.ceil(Chunk.size/this.zoom);

        let buffer = new Uint8ClampedArray(4*width*width);

        for (let x = 0; x < number; x++)
        for (let y = 0; y < number; y++) {
            let r, g, b, a;
            if (x+this.x < 0 || x+this.x >= W || y+this.y < 0 || y+this.y >= H) {
                // out of bounds
                [r, g, b, a] = [127, 127, 127, 255];
            }
            else {
                const col = colors[localGrid[y+this.y][x+this.x]];
                r = parseInt(col[0], 16)*17;
                g = parseInt(col[1], 16)*17;
                b = parseInt(col[2], 16)*17;
                a = 255;
            }

            for (let dx = 0; dx < pixSize; dx++) for (let dy = 0; dy < pixSize; dy++) {
                let i = (Math.floor(x*pixSize)+dx + (Math.floor(y*pixSize)+dy)*width)*4;
                buffer[i++] = r;
                buffer[i++] = g;
                buffer[i++] = b;
                buffer[i] = a;
            }
        }

        // convert the pixel array into an Image
        this.image = new Image();
        _ctx.putImageData(new ImageData(buffer, width, width), 0, 0);
        this.image.src = _canvas.toDataURL();
        this.ready = true;
    }

    edit(x, y) {
        const pixSize = scale*this.zoom;
        const number = Math.ceil(Chunk.size/this.zoom);

        // display the image on a canvas and edit it
        _ctx.drawImage(this.image, 0, 0);
        _ctx.fillStyle = "#"+colors[localGrid[y][x]];
        _ctx.fillRect(x%number*pixSize, y%number*pixSize, scale*this.zoom, scale*this.zoom);

        // get the image data back
        this.image.src = _canvas.toDataURL();
    }

    getPos() {
        const mult = scale*options.zoom;
        const x = (this.x-options.x)*mult + cW/2;
        const y = (this.y-options.y)*mult + cH/2;
        const size = Chunk.size*scale*options.zoom/this.zoom;

        return [x, y, size, size];
    }

    visible() {
        const [x, y, w, h] = this.getPos();
        return x < cW && y < cH && x+w >= 0 && y+h >= 0;
    }

    display() {
        const [x, y, w, h] = this.getPos();
        ctx.drawImage(this.image, x, y, w, h);
    }
}

class ChunkSystem {
    constructor() {
        this.chunks = {}; // generated chunks: {"x.y.zoom": Chunk}
        this.queue = {}; // chunks still generating
    }

    getZoom() {
        const shift = Math.floor(Math.log2(options.zoom))
        if (shift < 0) return 1/(1<<-shift);
        return 1<<shift;
    }

    getGridPos(x, y) {
        // convert pixel coordinates into grid coordinates
        x = options.x + (x-cW/2)/scale/options.zoom;
        y = options.y + (y-cH/2)/scale/options.zoom;

        return [x, y];
    }

    gridToChunk(x, y, zoom) {
        // find the top left of the chunk containing the given position
        const size = Math.floor(Chunk.size/zoom);
        return [Math.floor(x/size), Math.floor(y/size)];
    }

    editPixel(x, y) {
        const zoom = this.getZoom();
        const [cx, cy] = this.gridToChunk(x, y, zoom);
        const key = cx+"."+cy+"."+zoom;

        const inChunks = Object.keys(this.chunks).includes(key);

        let chunk;

        if (Object.keys(this.queue).includes(key)) chunk = this.queue[key];
        else {
            if (inChunks) chunk = this.chunks[key];
            else return; // no need to do anything, the chunk is unloaded
        }

        window.setTimeout(() => chunk.edit(x, y), 0);
    }

    onMove() {
        ctx.clearRect(0, 0, cW, cH);

        const zoom = this.getZoom();

        const keys = Object.keys(this.chunks);

        // get the chunks that collide with the screen
        let visible = {};
        keys.forEach(key => {
            const chunk = this.chunks[key];
            if (chunk.zoom == zoom && chunk.visible()) visible[key] = chunk;
        });

        // get the chunks that need to be displayed right now
        const [left, top] = this.getGridPos(0, 0);
        const [right, bottom] = this.getGridPos(cW-1, cH-1);

        const [leftC, topC] = this.gridToChunk(left, top, zoom);
        const [rightC, bottomC] = this.gridToChunk(right, bottom, zoom);

        const targetCount = (rightC-leftC+1)*(bottomC-topC+1);

        if (Object.values(visible).length == targetCount) {
            // enough chunks are ready: display them
            Object.values(visible).forEach(chunk => chunk.display());

            // delete the chunks that are on another zoom level
            Object.keys(this.chunks).forEach(key => {
                if (this.chunks[key].zoom != zoom) delete this.chunks[key];
            });
        }
        else {
            // not enough chunks are ready
            // display the "old" chunks (different zoom) at the back
            Object.values(this.chunks).forEach(chunk => {
                if (chunk.zoom != zoom) chunk.display();
            });

            // display the new chunks on top
            Object.values(visible).forEach(chunk => chunk.display());

            // schedule missing chunks
            const keys2 = Object.keys(this.queue);
            const mult = Math.floor(Chunk.size/zoom);

            for (let x = leftC; x <= rightC; x++)
            for (let y = topC; y <= bottomC; y++) {
                const key = x+"."+y+"."+zoom;
                if (!keys.includes(key) && !keys2.includes(key)) {
                    this.queue[key] = new Chunk(x*mult, y*mult, zoom);
                }
            }
        }
    }

    update() {
        const zoom = this.getZoom();

        let changed = 0;
        Object.keys(this.queue).forEach(key => {
            const chunk = this.queue[key];
            if (!chunk.ready && !changed) chunk.init();
            if (chunk.ready) {
                this.chunks[key] = chunk;
                delete this.queue[key];
                chunk.display(zoom);
                changed++;
            }
        });

        if (changed && Object.keys(this.queue).length == 0) {
            // no more items in the queue: display everything again
            // to delete non necessary chunks
            this.onMove();
        }
    }

    otherChecks() {
        const zoom = this.getZoom();

        Object.keys(this.chunks).forEach(key => {
            if (!this.chunks[key].visible()) delete this.chunks[key];
        });
    }
}

class Movement {
    constructor() {
        this.zoomTime = 0;
        this.zoomA = 1;
        this.zoomB = 1;

        window.addEventListener("wheel", event => this.zoom(event.deltaY < 0));
    }

    zoom(zoomIn) {
        this.zoomA = options.zoom
        if (this.zoomTime == 0) this.zoomB = options.zoom; // reset zoom

        this.zoomTime = Date.now();
        if (zoomIn) this.zoomB *= 1.2;
        else this.zoomB /= 1.2;

        if (this.zoomB < minZoom) this.zoomB = minZoom;
        else if (this.zoomB > maxZoom) this.zoomB = maxZoom;
    }

    update() {
        // returns true when the view changed, otherwise false

        let changed = false;
        if (this.zoomTime != 0) {
            const t = (Date.now()-this.zoomTime)/300;
            if (t < 1) {
                options.zoom = this.zoomA + (this.zoomB-this.zoomA)*smoothstep(t);
                changed = true;
            }
            else this.zoomTime = 0;
        }

        return changed;
    }
}

let smoothstep = x => (3-2*x)*x*x;

// used to convert ImageData into Image
const _canvas = document.createElement("canvas");
_canvas.width = Chunk.size*scale;
_canvas.height = Chunk.size*scale;
const _ctx = _canvas.getContext("2d");

function resizeCanvas(evt) {
    cW = window.innerWidth;
    cH = window.innerHeight;
    dom.canvas.width = cW;
    dom.canvas.height = cH;

    if (evt != null) chunkSystem.onMove();
}

function drawPixel(x, y, col) {
    localGrid[y][x] = col;
    chunkSystem.editPixel(x, y);
}

function showInfo(message) {
    console.warn(message);
    dom.info.innerHTML = message;
}

function update() {
    appUpdate();
    clientScriptUpdate();
}

function appUpdate() {
    if (state.mapOk) {
        if (movement.update()) chunkSystem.onMove();
        chunkSystem.update();
    }
}

function slowUpdate() {
    updateLocalStorage();
    chunkSystem.otherChecks();
}

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));
    ctx = dom.canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    resizeCanvas(null);
    loadLocalStorage();

    dom.canvas.addEventListener("click", click);
    window.addEventListener("resize", resizeCanvas);

    chunkSystem = new ChunkSystem();
    movement = new Movement();

    document.addEventListener("keydown", event => {
        if (!state.userOk) return;
        if (event.key == "a") {
            localStorage.clear();
            window.location.reload();
        }
        else if (event.key == "z") options.y -= 0.9/options.zoom;
        else if (event.key == "q") options.x -= 0.9/options.zoom;
        else if (event.key == "s") options.y += 0.9/options.zoom;
        else if (event.key == "d") options.x += 0.9/options.zoom;
        else if (event.key == "o") options.zoom /= 1.2;
        else if (event.key == "p") options.zoom *= 1.2;
        else if (event.key == "u") {
            options.x = cW/2/scale/options.zoom;
            options.y = cH/2/scale/options.zoom;
        }
        else if (event.key == "i") {
            options.x = 0;
            options.y = 0;
        }
        else options.color = (options.color+1) % user.nColors;
    });

    interval = window.setInterval(update, 1000/fps);

    window.setInterval(slowUpdate, 1000);

    socket.emit("initial");
}
