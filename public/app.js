let ctx;
let cW, cH;

let dom = {
    canvas: null,
    minimap: null,
    colors: null,
    info: null
}

let interval;

let chunkSystem;
let movement;
let minimap;

let fps = 60;

let isMobile;

let minimapSize = 200;

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

        this.image = null;
    }

    static toImage(buffer) {
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
        return image;
    }

    init() {
        // generate image if not generated yet, then wait until it is loaded into this.image
        if (this.image != null) {
            this.ready = this.image.complete;
            return;
        }

        const pixSize = scale*this.zoom;
        const width = scale*Chunk.size;
        const number = Math.ceil(Chunk.size/this.zoom);

        let buffer = new Uint8ClampedArray(4*width*width);

        for (let x = 0; x < number; x++)
        for (let y = 0; y < number; y++) {
            let r, g, b, a;
            if (x+this.x < 0 || x+this.x >= W || y+this.y < 0 || y+this.y >= H) continue;

            const col = colors[localGrid[y+this.y][x+this.x]];
            r = parseInt(col[0], 16)*17;
            g = parseInt(col[1], 16)*17;
            b = parseInt(col[2], 16)*17;
            a = 255;

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
        this.ready = false; // flag to wait for the image to load
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

        minimap.display();
    }

    update() {
        const zoom = this.getZoom();

        // handle initial chunks loading, one by one to reducs lag spikes
        let changed = false;
        Object.keys(this.queue).forEach(key => {
            const chunk = this.queue[key];
            if (!chunk.ready && !changed) chunk.init();
            if (chunk.ready) {
                this.chunks[key] = chunk;
                delete this.queue[key];
                chunk.display(zoom);
                changed = true;
            }
        });

        // handle chunk edits (wait for image load)
        Object.values(this.chunks).forEach(chunk => {
            if (!chunk.ready) {
                chunk.ready = chunk.image.complete;
                if (chunk.ready) chunk.display();
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
        this.time = 0;
        this.zoomA = 1;
        this.zoomB = 1;
        this.posA = [0, 0];
        this.posB = [0, 0];

        dom.canvas.addEventListener("wheel", evt => this.zoom(evt));
        dom.canvas.addEventListener("mousedown", evt => this.press(evt));
        dom.canvas.addEventListener("mouseup", evt => this.release(evt, false));
        dom.canvas.addEventListener("mouseout", evt => this.release(evt, true));
        dom.canvas.addEventListener("mousemove", evt => this.move(evt));

        this.pressed = false;
        this.mouse = [0, 0];
        this.mouseA = [0, 0]; // mouse pos at the start of a movement
    }

    evtToCoords(evt) {
        const x = (evt.x+window.scrollX-cW/2)/scale/options.zoom + options.x;
        const y = (evt.y+window.scrollY-cH/2)/scale/options.zoom + options.y;

        return [x, y];
    }

    zoom(evt) {
        this.release(evt);

        this.zoomA = options.zoom;
        if (this.time == 0) this.zoomB = options.zoom; // reset zoom

        // set up zoom change and animation
        this.time = Date.now();
        if (evt.deltaY < 0) this.zoomB *= 1.2;
        else this.zoomB /= 1.2;

        this.zoomB = Math.min(Math.max(this.zoomB, minZoom), maxZoom);

        // zoom around the cursor
        let [x, y] = this.evtToCoords(evt);

        this.posA = this.posB = [options.x, options.y];
        const mult = this.zoomA/this.zoomB;
        x = Math.min(Math.max(x + (options.x-x)*mult, 0), W);
        y = Math.min(Math.max(y + (options.y-y)*mult, 0), H);
        this.posB = [x, y];
    }

    press(evt) {
        if (this.pressed) return;
        this.pressed = true;

        this.move(evt);
        this.posA = [options.x, options.y];
        this.mouseA = this.mouse;
        this.zoomA = options.zoom;

        event.preventDefault();
    }

    move(evt) {
        this.mouse = [evt.x, evt.y];
    }

    release(evt, offscreen) {
        if (!this.pressed) return;

        if (!offscreen) {
            const dx = evt.x-this.mouseA[0];
            const dy = evt.y-this.mouseA[1];

            if (dx*dx + dy*dy <= 4) click(evt);
        }

        this.pressed = false;
    }

    update() {
        // returns true when the view changed, otherwise false

        let changed = false;
        if (this.time != 0) {
            let t = (Date.now()-this.time)/300;
            if (t < 1) {
                t = (3-2*t)*t*t;

                options.zoom = this.zoomA + (this.zoomB-this.zoomA)*t;
                options.x = this.posA[0] + (this.posB[0]-this.posA[0])*t;
                options.y = this.posA[1] + (this.posB[1]-this.posA[1])*t;
                changed = true;
            }
            else this.time = 0;
        }

        if (this.pressed) {
            const dx = (this.mouseA[0]-this.mouse[0])/scale/this.zoomA;
            const dy = (this.mouseA[1]-this.mouse[1])/scale/this.zoomA;

            options.x = this.posA[0]+dx;
            options.y = this.posA[1]+dy;

            changed = true;
        }

        return changed;
    }
}

class Minimap {
    constructor() {
        this.w = 200;
        this.h = Math.floor(this.w*H/W);

        dom.minimap.width = this.w;
        dom.minimap.height = this.h;
        this.ctx = dom.minimap.getContext("2d");

        this.ctx.fillStyle = "#0005";
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 2;
    }

    display() {
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.ctx.fillRect(0, 0, this.w, this.h);

        const x = options.x/W*this.w;
        const y = options.y/H*this.h;
        const w = cW/scale/options.zoom/W*this.w;
        const h = cH/scale/options.zoom/H*this.h;

        this.ctx.fillRect(x - w/2, y - h/2, w, h);
        this.ctx.beginPath();
        this.ctx.rect(x - w/2, y - h/2, w, h);
        this.ctx.stroke();
    }
}

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

    // also update isMobile
    isMobile = false;
(function (a) {if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a,)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4),))isMobile = true;})(navigator.userAgent || navigator.vendor || window.opera);
}

function drawPixel(x, y, col) {
    localGrid[y][x] = (col%colors.length + colors.length)%colors.length;
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

    window.addEventListener("resize", resizeCanvas);

    chunkSystem = new ChunkSystem();
    movement = new Movement();
    minimap = new Minimap();

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
