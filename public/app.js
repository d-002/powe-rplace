let socket = io();

let ctx;
let cW, cH;

// options loaded from user save
let zoom = 1, pos = [0, 0], currentColor = 1;
let size = 50;

// pixels pre-placed locally, waiting for server to accept or overrule
let placedLocally = {}; // hash: [x, y, prev col, timestamp]

let localGrid = [];
let needHelp = false;

let timeoutDelay = 10000;
let maintenanceTime = 0;
let interval;

let hashPixel = (x, y, col) => (x << col) + (y*123 << col+10) & 0xffff;

let dom = {
    canvas: null,
    colors: null
}

// WARNING: this object is only used to get a copy of the privileges, things like socket, version, ip are not defined
let user;

function resizeCanvas(evt) {
    cW = window.innerWidth;
    cH = window.innerHeight;
    dom.canvas.width = cW;
    dom.canvas.height = cH;

    if (evt != null) updateAllCanvas();
}

function updateUserOptions(data) {
    user = User.decodeString(undefined, data);

    // update colors in DOM
    dom.colors.innerHTML = "";
}

function drawPixel(x, y, col) {
    localGrid[y][x] = col;
    ctx.fillStyle = colors[col];
    const _x = x*size, _y = y*size;
    ctx.fillRect(_x, _y, size-1, size-1);
}

function updateAllCanvas() {
    ctx.clearRect(0, 0, cW, cH);

    for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++)
        drawPixel(x, y, localGrid[y][x]);
}

function click(evt) {
    const x = parseInt(evt.x/size);
    const y = parseInt(evt.y/size);
    const hash = hashPixel(x, y, currentColor);
    if (x < 0 || x >= W || y < 0 || y >= H) return;

    placedLocally[hash] = [x, y, localGrid[y][x], Date.now()];
    drawPixel(x, y, currentColor);
    updateLocalStorage();

    socket.emit("placePixel", x+"."+y+"."+currentColor+"."+hash);
}

function update() {
    const now = Date.now();
    let timeout = false;
    Object.values(placedLocally).forEach(options => { if (now-options[3] > timeoutDelay) timeout = true; });

    if (timeout) window.location.href="/down?reason=timeout";

    if (maintenanceTime != 0 && Date.now() > maintenanceTime+2000) window.location.href = "/down?reason=maintenance";
}

socket.on("mapUpdate", data => {
    try {
        applyUpdate(data, drawPixel, grid => { localGrid = grid });
    }
    catch (err) {
        if (!needHelp) console.error("Error loading the map, while not needing help: "+err);
    }

    needHelp = false;
    updateLocalStorage();
    updateAllCanvas();
});

socket.on("pixelFeedback", data => {
    // the last byte is for the error, the rest is the pixel hash
    const err = data & 0xff;
    const hash = data >> 8;

    const local = placedLocally[hash];
    if (local == null) return;
    const [x, y, col, _] = local;
    delete placedLocally[hash];

    if (err != 0) {
        // revert placement
        drawPixel(x, y, col);
        updateLocalStorage();
    }
});

socket.on("userUpdate", data => {
    user = User.decodeString(undefined, data);
});

function updateLocalStorage() {
    localStorage.setItem("map", encodeMap(localGrid));
}

function loadLocalStorage() {
    let item = localStorage.getItem("map");
    if (item == null) console.warn("No map found in local storage");
    else {
        try {
            localGrid = decodeMap(item, false);
            return;
        }
        catch {
            console.warn("Error loading map from local storage");
        }
    }

    // loading the map failed
    needHelp = true;
    socket.emit("help");
}

socket.on("duplicateIp", () => {
    window.location.href = "/down?reason=dupe-ip";
});

socket.on("maintenance", data => {
    maintenanceTime = Number(data);
    if (isNaN(maintenanceTime)) maintenanceTime = Date.now()+60000;
    console.log("Maintenance planned, starting in "+Math.ceil((maintenanceTime-Date.now())/1000)+"s");
});

window.onload = () => {
    dom.canvas = document.getElementById("canvas");
    dom.colors = document.getElementById("colors");
    ctx = dom.canvas.getContext("2d");
    resizeCanvas(null);
    loadLocalStorage();

    dom.canvas.addEventListener("click", click);
    window.addEventListener("resize", resizeCanvas);

    document.addEventListener("keydown", () => { currentColor = (currentColor+1) % colors.length });

    interval = window.setInterval(update, 100);

    socket.emit("initial");
}
