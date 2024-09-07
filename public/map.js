let fs, files, dirs;
function initMap(_fs, _files, _dirs) {
    fs = _fs;
    files = _files;
    dirs = _dirs;
}

const colors = [
    "#fff", "#000", "#f00", "#00f", "#f80", "#7c0", "#ff0", "#b1d",
    "#444", "#955", "#800", "#068", "#840", "#080", "#fd0", "#707",
    "#bbb", "#9ca", "#f88", "#9bf", "#fc8", "#af0", "#ee9", "#faf",
    "#777", "#559", "#f44", "#48f", "#c90", "#6c6", "#fe7", "#f7e"
];

const W = 64;
const H = 64;

const minZoom = 0.1;
const maxZoom = 10;
const scale = 20;

const versionFileSize = 1024;

// map packet decoding/encoding

function decodeMap(data, suppressErrors) {
    let pixels = [];

    if (data.length == W*H) {
        let x = W-1, y = -1;
        for (let i = 0; i < W*H; i++) {
            if (++x == W) {
                x = 0;
                y++;
                pixels.push(new Array(W));
            }

            pixels[y][x] = data.charCodeAt(i);
            if (isNaN(pixels[y][x])) pixels[y][x] = 0;
        }
    }

    if (pixels.length != H) {
        if (!suppressErrors) throw new Error("Failed to load canvas, length "+pixels.length);

        console.error("Setting grid to white canvas since failed to load, data length "+data.length);

        // white canvas if failed to load
        pixels = new Array(H).fill(null);
        for (let y = 0; y < H; y++) pixels[y] = new Array(W).fill(0);
    }

    return pixels;
}

function encodeMap(pixels) {
    let data = "";
    const len1 = pixels.length, len2 = pixels[0].length;
    for (let y = 0; y < len1; y++) {
        let line = "";
        for (let x = 0; x < len2; x++) line += String.fromCharCode(pixels[y][x]);
        data += line;
    }

    return data;
}

// version files handling

let getFile = version => dirs.logs+parseInt((version-1)/versionFileSize)+".log";

function logPixelChange(x, y, col, version) {
    // store x and y in two bytes, and col in one byte
    x = String.fromCharCode(x>>8)+String.fromCharCode(x&255);
    y = String.fromCharCode(y>>8)+String.fromCharCode(y&255);
    col = String.fromCharCode(col);
    fs.appendFileSync(getFile(version), x+y+col);
}

function getChecksum(grid) {
    if (grid.length == 0) return 0;
    let sum = grid.length+grid[0].length;

    const len1 = grid.length, len2 = grid[0].length;
    for (let y = 0; y < len1; y++)
    for (let x = 0; x < len2; x++)
        sum += grid[y][x];

    return sum & 65535;
}

function makeClientUpdate(clientVersion, serverVersion, serverGrid) {
    // make the client update its local map version
    
    // first char of message: grid checksum
    let message = String.fromCharCode(getChecksum(serverGrid));

    if (clientVersion > serverVersion) clientVersion = 0;
    if (clientVersion == serverVersion) return [false, message];

    // second char of message: either 0 or 1
    // if 0: message contains only a list of changes
    // if 1: message contains the full, updated map file

    const serverFile = getFile(serverVersion);

    let lengthy = clientVersion == null || serverFile != getFile(clientVersion);
    if (lengthy) {
        if (!clientVersion) clientVersion = 0;
        // need to read multiple log files to update the client: send the server map instead
        // in case an error occured with the client version, reset their map safely here
        message += String.fromCharCode(1)+encodeMap(serverGrid);
    }
    else {
        // only send the relevant changes to the client to then apply
        message += String.fromCharCode(0);

        let changes = String(fs.readFileSync(serverFile));

        const start = clientVersion%versionFileSize;
        const stop = serverVersion%versionFileSize || versionFileSize;
        message += changes.substring(start*5, stop*5);
    }

    return [lengthy, message];
}

function applyUpdate(message, updateFunction, setGrid) {
    if (message.length == 0) {
        console.log("Already up-to-date");
        return 0;
    }

    if (message[0].charCodeAt(0) == 0) {
        // individual changes to apply
        let n = 0;
        for (let i = 1, len = message.length; i < len; i++) {
            const x = (message.charCodeAt(i++)<<8) + message.charCodeAt(i++);
            const y = (message.charCodeAt(i++)<<8) + message.charCodeAt(i++);
            const col = message.charCodeAt(i);

            updateFunction(x, y, col);
            n++;
        }

        console.log("Caught up, applied "+n+" change"+(n == 1 ? "" : "s"));
    }
    else {
        // full map update
        setGrid(decodeMap(message.substring(1)));
        console.log("Caught up, refreshed entire map");
    }

    return 1;
}

// module is manually set to null on the client to avoid errors
if (module != null) module.exports = { colors, W, H, initMap, decodeMap, encodeMap, logPixelChange, makeClientUpdate, applyUpdate };
