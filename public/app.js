let ctx;
let cW, cH;

let dom = {
    // general
    clouds: null,
    canvas: null,
    info: null,
    debug: null,

    // sidebar
    sidebar: null,
    minimap: null,
    nClients: null,
    colors: null,

    // popup
    popup: null,
    startup: null,
    settings: null,
    termsok: null,
    noterms: null,
    userstats: null,

    // options
    tBorders: null,
    tDebug: null,
    tAa: null,

    // powerups
    powerups: null
}

let interval;
let colorsInterval;
let lastDebug;

let chunkSystem;
let movement;
let minimap;
let clouds;
let info;

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

class Info {
    constructor() {
        this.lastTime = 0;
        this.msg = null;

        this.prevState = -1;

        this.first = true;
    }

    show(message) {
        this.lastTime = message ? Date.now() : 0;
        this.msg = message;

        this.update(true);
    }

    update(force=false) {
        const t = (Date.now()-this.lastTime)/5000;
        const delay = user ? user.pixelCooldown-Date.now()+user.lastPixel : 0;
        const state = t <= 1 ? t <= 0.8 ? 0 : t*5-4 : delay <= 0 ? 2 : 2+delay;

        if (state != this.prevState || force) {
            const prevhtml = dom.info.innerHTML;
            let newhtml = prevhtml;
            dom.info.style = "";

            if (state < 2) {
                // show custom message
                newhtml = this.msg;
                if (state) dom.info.style = "--a: "+(1-state);
            }
            else if (user) {
                // show cooldown info
                if (state == 2) {
                    newhtml = "You can place your "+(user.nPlaced ? "next" : "first")+" pixel!";

                    // try to send a notification
                    if (Notification.permission == "default" && user.nPlaced != 0)
                        Notification.requestPermission();
                    else this.notification();
                }
                else newhtml = "You can place your next pixel in "+Math.ceil(delay/1000)+"s";
            }
            else newhtml = "Loading cooldown...";

            if (newhtml != prevhtml) dom.info.innerHTML = newhtml;
        }

        this.prevState = state;
    }

    notification() {
        if (document.hasFocus()) return;
        if (this.first) {
            this.first = false;
            return;
        }
        if (Notification.permission == "granted") {
            new Notification("Your next pixel is ready", {
                body: "You can place your next pixel on POWE-R/Place!",
                icon: "/img/icon/icon-512.png"
            });
        }
    }
}

function startup() {
    //showPopup(dom.startup, dom.settings, acceptedTerms);

    dom.debug.style.display = options.debug ? null : "none";
    if (options.borders) toggleElt(dom.tBorders);
    if (options.debug) toggleElt(dom.tDebug);

    if (acceptedTerms) dom.noterms.style.display = "none";
    else dom.termsok.style.display = "none";
}

function settings() {
    showPopup(dom.settings, dom.startup, true);

    // edit stats in settings
    const t = user.getPlayTime()/1000;

    const h = Math.floor(t/3600);
    const min = Math.floor(t%3600/60);
    const s = Math.floor(t%60);

    let time = "";
    if (h) time += " "+h+"h";
    if (min) time += " "+min+"min";
    if (s) time += " "+s+"s";

    dom.userstats.innerHTML = "<p>Play time:"+time+"</p>\n<p>Placed pixels: "+user.nPlaced;
}

function showPopup(show, hide, listener) {
    hide.style.display = "none";
    show.style.display = null;

    dom.popup.style.display = null;
    dom.popup.className = "";
    dom.popup.offsetWidth;
    dom.popup.className = "show";

    // close popup by clicking on the transparent part
    if (listener) dom.popup.addEventListener("click", closeMenu);
}

function closeMenu(evt) {
    // if triggered by a click event, don't close when clicked on the left
    if (evt && evt.x+window.scrollY < Math.min(cW*0.4, 600)) return;

    dom.popup.className = "";
    dom.popup.offsetWidth;
    dom.popup.className = "hide";

    dom.popup.removeEventListener("click", closeMenu);

    window.setTimeout(() => {dom.popup.style.display = "none"}, 500);
}

function agree() {
    acceptedTerms = true;
    updateLocalStorage();
    closeMenu();
}

function discord() {
    window.open("https://discord.gg/B3mwVDhf", "_blank").focus();
}

function github() {
    window.open("https://github.com/d-002/powe-rplace", "_blank").focus();
}

function openPowerups() {
    dom.powerups.className = "";
    dom.powerups.offsetWidth;
    dom.powerups.className = "show";
    dom.sidebar.className = "";
    dom.sidebar.offsetWidth;
    dom.sidebar.className = "hide";
}

function closePowerups() {
    dom.powerups.className = "";
    dom.powerups.offsetWidth;
    dom.powerups.className = "hide";
    dom.sidebar.className = "";
    dom.sidebar.offsetWidth;
    dom.sidebar.className = "show";
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

    setPixelated();

    if (evt != null) chunkSystem.onMove();

    // also update isMobile
    isMobile = false;
(function (a) {if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a,)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4),))isMobile = true;})(navigator.userAgent || navigator.vendor || window.opera);

    // update colors, but not on init
    if (evt) updateColorsLayout();
}

function setPixelated() {
    if (clouds) clouds.ctx.imageSmoothingEnabled = options.aa;
    ctx.imageSmoothingEnabled = options.aa;
    const pixel = options.aa ? "" : "pixel";
    dom.canvas.className = pixel;
    dom.clouds.className = pixel;
}

function drawPixel(x, y, col) {
    localGrid[y][x] = (col%colors.length + colors.length)%colors.length;
    changedMap = true;
    chunkSystem.editPixel(x, y);
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
    clouds.update(true);
    info.update();
    updateDebug();
}

function updateDebug() {
    if (!options.debug || Date.now()-lastDebug < 200) return;
    lastDebug = Date.now();

    let s = document.title;
    s += "<br />Used memory: "+window.performance.memory.usedJSHeapSize;
    s += "<br />Chunks loaded: "+Object.keys(chunkSystem.chunks).length+", queued: "+Object.keys(chunkSystem.queue).length;
    s += "<br />Loaded: map "+state.mapOk+", user "+state.userOk+", options "+state.optionsOk;
    s += "<br />Target FPS: "+fps;
    if (user) {
        s += "<br />User: v "+user.version+", last "+user.lastPixel;
        s += "<br />colors "+user.nColors+", cooldown "+user.pixelCooldown;
    }
    else s += "<br />User: "+user;

    dom.debug.innerHTML = s;
}

function setcol(i) {
    i = (parseInt(Math.abs(i)) || 0) % (user ? user.nColors : privileges.colors[0]);

    const a0 = dom.colors.children[options.color&7].children[0];
    const a1 = dom.colors.children[i&7].children[0];
    a0.style = "--col: "+colors[options.color&7];
    a0.classList.remove("selected");
    a1.style = "--col: "+colors[i];
    a1.classList.add("selected");

    dom.colors.children[options.color&7].children[1].children[0].children[options.color>>3].classList.remove("selected");
    dom.colors.children[i&7].children[1].children[0].children[i>>3].classList.add("selected");
    dom.colors.style.pointerEvents = "none";
    window.setTimeout(() => {dom.colors.style.pointerEvents = null}, 500);

    i = Math.floor(i) || 0;
    if (i < 0 || i >= user ? user.nColors : NaN) return;
    options.color = i;

    updateLocalStorage();
}

function populateColors() {
    dom.colors.innerHTML = "";

    const count = user ? user.nColors>>3 : 4;

    for (let i = 0; i < 8; i++) {
        const div = document.createElement("div");
        let html = "<a class='color' style='--col: "+colors[i]+"'></a><div><div class='submenu'>";
        for (let x = 0; x < count; x++) {
            html += "<a href='javascript:setcol("+(i + x*8)+")' class='color' style='--col: "+colors[i + x*8]+"'></a>";
        }
        div.innerHTML = html+"</div></div>";
        dom.colors.appendChild(div);
    }

    updateColorsLayout();

    setcol(options.color);
}

function updateColorsLayout() {
    let heights = [];
    dom.colors.style = "";
    dom.colors.className = "fakeHover";
    dom.colors.innerWidth;
    const top = dom.colors.getBoundingClientRect().top;
    for (let i = 0; i < 8; i++) {
        const h = dom.colors.children[i].getBoundingClientRect().top-top-5;
        if (!heights.includes(h)) heights.push(h);

        dom.colors.children[i].style = "--y: "+h+"px";
    }
    dom.colors.className = "";

    // prevent the height from being something like 1.5 element
    dom.colors.style = "--size: "+(user ? user.nColors>>3 : 4)+"; --colw: "+Math.ceil(user ? 8/heights.length : 1)+"; --colh: "+heights.length;
}

function toggleElt(elt) {
    if (elt.className.includes("active")) elt.classList.remove("active");
    else elt.classList.add("active");
}

function updateNClients(n) {
    dom.nClients.innerHTML = n+" online right now";
}

// options
function tResetPos() {
    // smoothly translate
    closeMenu();

    window.setTimeout(() => {
        const start = Date.now();
        const prev = [options.x, options.y, options.zoom];

        const interval = window.setInterval(() => {
            let t = (Date.now()-start)/500;
            if (t > 1) {
                options.x = W/2;
                options.y = H/2;
                options.zoom = 1;
                updateLocalStorage();
                window.clearInterval(interval);
                return;
            }

            t = (3 - 2*t)*t*t;
            options.x = prev[0] + (W/2-prev[0])*t;
            options.y = prev[1] + (H/2-prev[1])*t;
            options.zoom = prev[2] + (1-prev[2])*t;
            chunkSystem.onMove();
        }, 1000/fps);
    }, 500);
}

function tBorders() {
    toggleElt(dom.tBorders);
    options.borders = 1-options.borders;
    updateLocalStorage();
    chunkSystem.reset();
}

function tAa() {
    toggleElt(dom.tAa);
    options.aa = 1-options.aa;
    updateLocalStorage();
    setPixelated();
    chunkSystem.reset();
}

function tRefreshMap() {
    socket.emit("help");
    chunkSystem.reset();
}

function tDebug() {
    toggleElt(dom.tDebug);
    options.debug = 1-options.debug;
    updateLocalStorage();

    dom.debug.style.display = options.debug ? null : "none";
}

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));

    info = new Info();
    info.show("Loading...");

    ctx = dom.canvas.getContext("2d");

    dom.nClients.innerHTML = "Connecting...";
    loadLocalStorage();
    resizeCanvas(null);

    populateColors();

    startup();

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

    colorsInterval = window.setInterval(() => {
        if (stateOk()) {
            info.show(null);
            window.clearInterval(colorsInterval);
        }
    }, 100);

    socket.emit("initial");
}
