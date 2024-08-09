let socket = io();

// options loaded from user save
let zoom = 1, pos = [0, 0], currentColor = 1;
let size = 50;

// pixels pre-placed locally, waiting for server to accept or overrule
let placedLocally = {}; // hash: [x, y, prev col, timestamp]

let localGrid = [];

let state = {
    "mapOk": false, // if the map is in sync with the server
    "userOk": false // if the user has been loaded
};
let stateOk = () => !Object.values(state).includes(false);

let timeoutDelay = 10000;
let maintenanceTime = 0;
let interval;

let hashPixel = (x, y, col) => (x << col) + (y*123 << col+10) & 0xffff;

// WARNING: this object is only used to get a copy of the privileges, things like socket, version, ip are not defined
let user;

function click(evt) {
    if (!stateOk()) {
        showInfo("Some data is still loading, you can't place a pixel right now.");
        return;
    }

    const x = parseInt(evt.x/size);
    const y = parseInt(evt.y/size);
    const hash = hashPixel(x, y, currentColor);
    if (x < 0 || x >= W || y < 0 || y >= H) return;

    placedLocally[hash] = [x, y, localGrid[y][x], Date.now()];
    drawPixel(x, y, currentColor);
    updateLocalStorage();

    socket.emit("placePixel", x+"."+y+"."+currentColor+"."+hash);
}

function clientScriptUpdate() {
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

    state.mapOk = true;
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

    state.userOk = true;
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
    state.mapOk = false;
    socket.emit("help");

    showInfo("Failed to read map locally, asking for refresh...");
}

socket.on("noHelp", () => {
    // help was refused, explain why if needed
    showInfo("You are being rate limited, please try again later.");
});

socket.on("duplicateIp", () => {
    window.location.href = "/down?reason=dupe-ip";
});

socket.on("maintenance", data => {
    maintenanceTime = Number(data);
    if (isNaN(maintenanceTime)) maintenanceTime = Date.now()+60000;
    console.log("Maintenance planned, starting in "+Math.ceil((maintenanceTime-Date.now())/1000)+"s");
});
