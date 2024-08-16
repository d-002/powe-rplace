let ctx;
let cW, cH;

let dom = {
    clouds: null,
    canvas: null,
    minimap: null,
    colors: null,
    info: null
}

let interval;

let chunkSystem;
let movement;
let minimap;
let clouds;

let fps = 60;

let isMobile;

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

            options.x = Math.min(Math.max(this.posA[0]+dx, 0), W);
            options.y = Math.min(Math.max(this.posA[1]+dy, 0), H);

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

        this.ctx.fillStyle = "#0004";
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

class Clouds {
    static n = 10;

    constructor() {
        this.images = [];
        this.pos = [];
        for (let i = 1; i <= 17; i++) {
            const image = new Image();
            image.src = "img/"+i+".png";
            this.images.push(image);

            if (i <= Clouds.n)
                this.pos.push([Math.floor(Math.random()*17), Math.random()*(cW+50)-50, Math.random()*cH, Math.random()*5+5, 0, 0]);
        }

        this.pos = this.pos.sort((a,b) => a[3]-b[3]);

        this.ctx = dom.clouds.getContext("2d");

        this.ready = false;

        this.last = 0;
    }

    isReady() {
        for (let i = 0; i < this.images.length; i++) {
            if (this.images[i].complete) {
                if (i >= this.pos.length) continue;
                const j = this.pos[i][0];
                this.pos[i][4] = this.images[j].width;
                this.pos[i][5] = this.images[j].height;
            }
            else return false;
        }
        return true;
    }

    update() {
        if (!this.ready) {
            this.ready = this.isReady();
            if (!this.ready) return;
        }

        if (Date.now()-this.last < 500) return;
        this.last = Date.now();

        // don't update when the clouds aren't visible
        const w = cW/scale/options.zoom;
        const h = cH/scale/options.zoom;

        if (options.x > w && options.x < W-w && options.y > h && options.y < H-h) return;

        this.ctx.clearRect(0, 0, cW, cH);

        for (let i = 0; i < this.pos.length; i++) {
            let [j, x, y, step, width, height] = this.pos[i];
            x += step;

            let wrap = false;
            if (x < -width) {
                x += cW;
                wrap = true;
            }
            else if (x >= cW) {
                x -= cW+width;
                wrap = true;
            }

            if (wrap) y = Math.random()*cH;
            this.pos[i] = [j, x, y, step, width, height];

            this.ctx.drawImage(this.images[j], x, y, width, height);
        }
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
    dom.clouds.width = cW;
    dom.clouds.height = cH;
    dom.canvas.width = cW;
    dom.canvas.height = cH;

    if (evt != null) chunkSystem.onMove();

    // also update isMobile
    isMobile = false;
(function (a) {if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a,)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4),))isMobile = true;})(navigator.userAgent || navigator.vendor || window.opera);
}

function drawPixel(x, y, col) {
    localGrid[y][x] = (col%colors.length + colors.length)%colors.length;
    changedMap = true;
    chunkSystem.editPixel(x, y);
}

function showInfo(message) {
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
    clouds.update();
}

function setcol(i) {
    i = (parseInt(Math.abs(i)) || 0) % (user ? user.nColors : privileges.colors[0]);

    dom.colors.children[options.color&7].children[options.color>>3].classList.remove("selected");
    dom.colors.children[i&7].children[i>>3].classList.add("selected");
    dom.colors.style = "pointer-events: none";
    window.setTimeout(() => {dom.colors.style = ""}, 100);

    i = Math.floor(i) || 0;
    if (i < 0 || i >= user ? user.nColors : NaN) return;
    options.color = i;

    updateLocalStorage();
}

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));

    showInfo("Loading...");

    for (let y = 0; y < 8; y++) {
        const div = document.createElement("div");
        div.style = "--index: "+y;
        for (let x = 0; x < 3; x++) {
            const col = document.createElement("a");
            col.href = "javascript:setcol("+(y+x*8)+")";
            col.className = "color";
            col.style = "--col: #"+colors[y + x*8];
            col.setAttribute("index", y + x*8);
            div.appendChild(col);
        }
        dom.colors.appendChild(div);
    }

    ctx = dom.canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    resizeCanvas(null);
    loadLocalStorage();

    window.addEventListener("resize", resizeCanvas);

    chunkSystem = new ChunkSystem();
    movement = new Movement();
    minimap = new Minimap();
    clouds = new Clouds();

    document.addEventListener("keydown", event => {
        if (event.key == "a") {
            localStorage.clear();
            window.location.reload();
        }
    });

    interval = window.setInterval(update, 1000/fps);

    socket.emit("initial");
}
