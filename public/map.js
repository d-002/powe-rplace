let fs, files, dirs;
function initMap(_fs, _files, _dirs) {
    fs = _fs;
    files = _files;
    dirs = _dirs;
}

const colors = ['#fff', '#000', '#f00', '#00f', '#f80', '#080', '#ff0', '#a0c', '#800', '#008', '#840', '#068', '#fd0', '#880', '#af0', '#707', '#bbb', '#444', '#f88', '#88f', '#fc8', '#8f8', '#ffc', '#f7e'];

const W = 16;
const H = 16;

const versionFileSize = 10;

// map packet decoding/encoding

function decodeMap(data) {
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

        console.error("White canvas, failed to load, length "+pixels.length);

        // white canvas if failed to load
        pixels = new Array(H).fill(null);
        for (let y = 0; y < H; y++) pixels[y] = new Array(W).fill(0);
    }

    return pixels;
}

function encodeMap(pixels) {
    let data = "";
    for (let y = 0; y < pixels.length; y++) {
        let line = "";
        for (let x = 0; x < pixels[y].length; x++) line += String.fromCharCode(pixels[y][x]);
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
    fs.appendFileSync(getFile(++version), x+y+col);

    return version;
}

function makeClientUpdate(clientVersion, serverVersion, serverGrid) {
    // make the client update its local map version

    if (clientVersion == serverVersion) return "";

    // first byte of message: either 0 or 1
    // if 0: message contains only a list of changes
    // if 1: message contains the full, updated map file
    let message;

    const serverFile = getFile(serverVersion);
    if (clientVersion == null || clientVersion > serverVersion || serverFile != getFile(clientVersion)) {
        // need to read multiple log files to update the client: send the server map instead
        // in case an error occured with the client version, reset their map safely here
        message = String.fromCharCode(1)+encodeMap(serverGrid);
    }
    else {
        // only send the relevant changes to the client to then apply
        message = String.fromCharCode(0);

        let changes = String(fs.readFileSync(serverFile));

        const start = clientVersion%versionFileSize;
        const stop = serverVersion%versionFileSize || versionFileSize;
        message += changes.substring(start*5, stop*5);
    }

    return message;
}

function applyUpdate(message, updateFunction, setGrid) {
    if (message.length == 0) {
        console.log("Already up-to-date");
        return;
    }

    if (message[0].charCodeAt(0) == 0) {
        // individual changes to apply
        let n = 0;
        for (let i = 1; i < message.length; i++) {
            const x = (message.charCodeAt(i++)<<8) + message.charCodeAt(i++);
            const y = (message.charCodeAt(i++)<<8) + message.charCodeAt(i++);
            const col = message.charCodeAt(i);
            console.log(x+" "+y+" "+col);

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
}

// module is manually set to null on the client to avoid errors
if (module != null) module.exports = { colors, W, H, initMap, decodeMap, encodeMap, logPixelChange, makeClientUpdate, applyUpdate };
