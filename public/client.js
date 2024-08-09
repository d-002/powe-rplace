let socket = io();

class _socket {
    constructor(s) {
        this.s = s;
    }

    emit(type, data) {
        console.log("emit "+type+" "+(data||"").substring(0, 50));
        this.s.emit(type, data);
    }

    on(type, callback) {
        this.s.on(type, data => {
            console.log("recv "+type+" "+String(data).substring(0, 50));
            callback(data);
        });
    }
}
socket = new _socket(socket);

// pixels pre-placed locally, waiting for server to accept or overrule
let placedLocally = {}; // hash: [x, y, prev col, timestamp]

let localGrid = [];

let state = {
    "mapOk": false, // if the map is in sync with the server
    "userOk": false, // if the user has been loaded
    "optionsOk": false
};
let stateOk = () => !Object.values(state).includes(false);

let maintenanceTime = 0;
let interval;

let hash = x => {
    const h = String.fromCharCode(x);
    if (h == ".") return " ";
    return h;
}
let hashPixel = (x, y, col) => hash(x)+hash(y)+hash(col);

// WARNING: this object is only used to get a copy of the privileges, things like socket, version, ip are not defined
let user;

let options = {
    x: 0,
    y: 0,
    zoom: 1,
    color: 0
};

function click(evt) {
    if (!stateOk()) {
        showInfo("Some data is still loading, you can't place a pixel right now.");
        return;
    }

    const x = parseInt((evt.x-window.scrollX)/scale/options.zoom - options.x);
    const y = parseInt((evt.y-window.scrollY)/scale/options.zoom - options.y);
    const hash = hashPixel(x, y, options.color);
    if (x < 0 || x >= W || y < 0 || y >= H) return;

    placedLocally[hash] = [x, y, localGrid[y][x], Date.now()];
    drawPixel(x, y, options.color);
    updateLocalStorage();

    socket.emit("placePixel", x+"."+y+"."+options.color+"."+hash);
}

function clientScriptUpdate() {
    const now = Date.now();
    let timeout = false;
    Object.values(placedLocally).forEach(options => { if (now-options[3] > privileges.timeoutDelay) timeout = true; });

    if (timeout) console.warn("timeout");
    //if (timeout) window.location.href="/down?reason=timeout";

    if (maintenanceTime != 0 && Date.now() > maintenanceTime+2000) window.location.href = "/down?reason=maintenance";
}

socket.on("mapUpdate", data => {
    let changes;
    try {
        changes = applyUpdate(data, drawPixel, grid => { localGrid = grid });
    }
    catch (err) {
        console.error("Error loading the map: "+err);
        return;
    }

    // TODO change this, checksum checks go here
    if (!state.mapOk && !changes) {
        console.warn("Up to date with server, but wrong map, refreshing");
        socket.emit("help");
    }
    else {
        state.mapOk = true;
        updateLocalStorage();
        updateAllCanvas();
    }
});

socket.on("pixelFeedback", data => {
    // first char for the error, the rest is the pixel hash
    const err = data.charCodeAt(0);
    const hash = data.substring(1);

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
    options.color = (options.color%user.nColors+user.nColors) % user.nColors;

    state.userOk = true;
});

function updateLocalStorage() {
    localStorage.setItem("map", encodeMap(localGrid));

    localStorage.setItem("options", options.x+" "+options.y+" "+options.zoom+" "+options.color);
}

function loadLocalStorage() {
    // load map
    let map = localStorage.getItem("map");
    let error = false;
    if (map == null) console.log("No map found in local storage");
    else {
        try {
            localGrid = decodeMap(map, false);

            state.mapOk = true;
        }
        catch {
            error = true;
        }
    }

    if (error) {
        // loading the map failed
        state.mapOk = false;
        socket.emit("help");

        showInfo("Failed to read map locally, asking for refresh...");
    }

    // load options
    let data = localStorage.getItem("options");
    if (data == null) console.log("No options found in local storage");
    else try {
        data = data.split(" ");
        options.x = Number(data[0]) || 0;
        options.y = Number(data[1]) || 0;
        options.zoom = Number(data[2]) || 1;
        options.color = parseInt(data[3]) || 0;
        if (options.zoom < minZoom) options.zoom = minZoom;
        if (options.zoom > maxZoom) options.zoom = maxZoom;
    }
    catch(err) {
        showInfo("Failed to parse options, settings may be reset: "+err);
    }

    state.optionsOk = true;
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

socket.on("disconnect", () => {
    try {
        socket.disconnect();
        socket.removeAllListeners();
        socket = null;
    }
    catch { }

    window.location.href="/down?reason=disconnect";
});
