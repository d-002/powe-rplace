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
//socket = new _socket(socket);

// pixels pre-placed locally, waiting for server to accept or overrule
let placedLocally = {}; // hash: [x, y, prev col, timestamp]

let localGrid = [];
let changedMap = false;
let startedNoHelpTimeout = false;

let acceptedTerms = false;

let state = {
    "mapOk": false, // if the map is in sync with the server
    "userOk": false, // if the user has been loaded
    "optionsOk": false
};
let stateOk = () => !Object.values(state).includes(false);

let maintenanceTime = 0;

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
    color: 1,
    borders: 1,
    debug: 0
};

function click(evt) {
    if (!stateOk()) {
        info.show("Some data is still loading, you can't place a pixel right now.");
        return;
    }

    let [x, y] = movement.evtToCoords(evt);
    x = Math.floor(x);
    y = Math.floor(y);
    const hash = hashPixel(x, y, options.color);
    if (x < 0 || x >= W || y < 0 || y >= H) return;

    placedLocally[hash] = [x, y, localGrid[y][x], Date.now()];
    drawPixel(x, y, options.color);

    socket.emit("placePixel", x+"."+y+"."+options.color+"."+hash);
}

function clientScriptUpdate() {
    const now = Date.now();
    let timeout = false;
    Object.values(placedLocally).forEach(options => { if (now-options[3] > privileges.timeoutDelay) timeout = true; });

    if (timeout) window.location.href="/down?reason=timeout";

    if (maintenanceTime != 0 && Date.now() > maintenanceTime+2000) window.location.href = "/down?reason=maintenance";
}

socket.on("mapUpdate", data => {
    let checksum = data.charCodeAt(0);

    if (startedNoHelpTimeout) {
        info.show("Refreshed the map.");
        startedNoHelpTimeout = false;
    }

    let changes;
    try {
        changes = applyUpdate(data.substring(1), drawPixel, grid => { localGrid = grid });
        if (changes) changedMap = true;

        if (checksum != getChecksum(localGrid)) {
            console.warn("Map is desync, refreshing");
            socket.emit("help");
            return;
        }
    }
    catch (err) {
        console.error("Error loading the map: "+err);
        console.log("Refreshing");

        socket.emit("help");
        return;
    }

    // TODO change this, checksum checks go here
    if (!state.mapOk && !changes) {
        console.warn("Up to date with server, but map not loaded, refreshing");
        socket.emit("help");
    }
    else {
        state.mapOk = true;
        updateLocalStorage();
        chunkSystem.onMove();
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

    // allowed change: update client-side map
    if (err == 0) {
        user.nPlaced++;
        user.lastPixel = Date.now();
        updateLocalStorage();
    }
    // revert placement
    else drawPixel(x, y, col);
});

socket.on("userUpdate", data => {
    user = User.decodeString(undefined, data);
    options.color = (options.color%user.nColors+user.nColors) % user.nColors;

    state.userOk = true;
});

socket.on("nClients", n => {
    updateNClients(n);
});

function updateLocalStorage() {;
    if (changedMap) {
        localStorage.setItem("map", encodeMap(localGrid));
        changedMap = false;
    }

    if (!state.optionsOk) return;

    localStorage.setItem("terms", acceptedTerms ? 1 : 0);

    localStorage.setItem("options", options.x+" "+options.y+" "+options.zoom+" "+options.color+" "+options.borders+" "+options.debug);
}

function loadLocalStorage() {
    // load important stuff
    acceptedTerms = localStorage.getItem("terms") == "1";

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

        info.show("Failed to read map locally, asking for refresh...");
    }

    // load options
    let data = localStorage.getItem("options");
    if (data == null) console.log("No options found in local storage");
    else try {
        data = data.split(" ");
        options.x = Number(data[0]);
        options.y = Number(data[1]);
        if (isNaN(options.x)) options.x = W/2;
        if (isNaN(options.y)) options.y = H/2;
        options.x = Math.min(Math.max(options.x, 0), W);
        options.y = Math.min(Math.max(options.y, 0), H);
        options.zoom = Math.min(Math.max(Number(data[2]) || 1, minZoom), maxZoom);
        options.color = parseInt(data[3]) || 0;
        options.borders = parseInt(data[4]) || 0;
        options.debug = parseInt(data[5]) || 0;
    }
    catch(err) {
        info.show("Failed to parse options, settings may be reset: "+err);
    }

    changedMap = false;

    state.optionsOk = true;
}

socket.on("noHelp", () => {
    // help was refused, explain why if needed
    info.show("You are being rate limited, the map will refresh soon...");

    // don't start multiple timeouts at once
    if (!startedNoHelpTimeout) {
        startedNoHelpTimeout = true;
        window.setTimeout(() => {
            socket.emit("help");
        }, privileges.helpCooldown+1000);
    }
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

    window.location.href = "/down?reason=disconnect";
});

socket.on("blacklist", () => {window.location.href = "/down?reason=blacklist";});
