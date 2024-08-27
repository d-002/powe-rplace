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
            if (x+this.x < 0 || x+this.x >= W || y+this.y < 0 || y+this.y >= H) continue;

            const col = colors[localGrid[y+this.y][x+this.x]];
            const r = parseInt(col[1], 16)*17;
            const g = parseInt(col[2], 16)*17;
            const b = parseInt(col[3], 16)*17;

            for (let dx = 0; dx < pixSize; dx++) for (let dy = 0; dy < pixSize; dy++) {
                let i = (Math.floor(x*pixSize)+dx + (Math.floor(y*pixSize)+dy)*width)*4;
                if (options.borders && options.zoom > 0.5 && !(dx && dy))
                    buffer[i++] = buffer[i++] = buffer[i++] = 127;
                else {
                    buffer[i++] = r;
                    buffer[i++] = g;
                    buffer[i++] = b;
                }
                buffer[i] = 255;
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

        const add = options.borders && options.zoom > 0.5 ? 1 : 0;

        // display the image on a canvas and edit it
        _ctx.drawImage(this.image, 0, 0);
        _ctx.fillStyle = colors[localGrid[y][x]];
        _ctx.fillRect(x%number*pixSize + add, y%number*pixSize + add, scale*this.zoom - add, scale*this.zoom - add);

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

        this.lastOther = 0;
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

        if (Date.now()-this.lastOther >= 1000) {
            updateLocalStorage();
            this.otherChecks();
            this.lastOther = Date.now();
        }
    }

    otherChecks() {
        const zoom = this.getZoom();

        Object.keys(this.chunks).forEach(key => {
            if (!this.chunks[key].visible()) delete this.chunks[key];
        });
    }

    reset() {
        this.queue = [];
        this.chunks = [];

        this.onMove();
    }
}

