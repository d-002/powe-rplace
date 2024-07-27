const { decodePixelData, encodePixelData, colors, colorsLengths, W, H } = require(__dirname+"/pixelUtils.js");
const { initAccounts, canPlacePixel, placePixel } = require(__dirname+"/accounts.js");
const { initUser, User, decodeUserFile, encodeUserFile } = require(__dirname+"/user.js");

// files
const files = {
    "options": "/files/options.txt",
    "inCooldown": "/files/inCooldown.csv",
    "grid": "/files/grid.csv"
}
const dirs = {
    "logsFolder": "/files/logs/",
    "accountsFolder": "/files/accounts/"
}


// set up server
const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const fs = require("fs");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const port = 8080;

let clients = {}; // ip: User object

// init modules
initAccounts(fs, files, dirs);
initUser(fs, files, dirs);

app.use(express.static(__dirname+"/public"));

// landing page
app.get("/", (req, res) => {
    res.sendFile(ready ? __dirname+"/index.html" : __dirname+"/loading.html");
});

// to import modules on the client
app.get("/modules/pixelUtils.js", (req, res) => {
    res.sendFile(__dirname+"/pixelUtils.js");
});


let ready = false; // display loading page while not ready

// create directories and files if non-existant
console.log("Checking files...");
const mainDir = __dirname+'/files';
if (!fs.existsSync(mainDir)) {
    fs.mkdirSync(mainDir);
    console.log('Created main dir');
}

Array.from(Object.keys(dirs)).forEach(name => {
    let dir = __dirname+dirs[name];
    dirs[name] = dir;

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
	console.log('Created dir '+dir);
    }
});

Array.from(Object.keys(files)).forEach(name => {
    let file = __dirname+files[name];
    files[name] = file;

    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, '');
	console.log('Created file '+file);
    }
});

// read options
let logsVersion = 0; // increases by 1 every map edit, to apply changes to clients

const lines = String(fs.readFileSync(files.options)).split("\n");
try {
    let value = parseInt(lines[0]);
    if (!isNaN(value)) W = value;
    value = parseInt(lines[1]);
    if (!isNaN(value)) H = value;
}
catch(e) {
    console.log("Error while loading options: "+e);
}

console.log("Reading canvas array...");
let pixelData = decodePixelData(String(fs.readFileSync(files.grid)));

function getUserPath(ip) {
    return dirs[accountsFolder]+ip;
}


io.on("connection", socket => {
    let ip = socket.handshake.address.address;
    if (ip == null) {
	ip = "127.0.0.1";
	console.warn("Undefined IP, setting to "+ip);
    }

    clients[ip] = decodeUserFile(ip, colorsLengths[0], 10);
    clients[ip].socket = socket;
    console.log("new connection from "+ip);

    socket.emit("initial", encodePixelData(pixelData));

    socket.on("placePixel", message => {
	// parse request, check if correct
	let ok = true;
	let x, y, col, hash;

	let s = message.split(" ");
	if (s.length == 4) {
	    x = parseInt(s[0]);
	    y = parseInt(s[1]);
	    col = parseInt(s[2]);
	    hash = parseInt(s[3]);
	}
	else ok = false;
	if (isNaN(x) || x < 0 || x >= W) ok = false;
	else if (isNaN(y) || y < 0 || y >= H) ok = false;

	ok &= canPlacePixel(clients[ip]);

	socket.emit("pixelFeedback", (hash << 8) + (ok ? 0 : 1));
	if (ok)	{
	    pixelData[y][x] = col;
	    placePixel(clients[ip]);
	    encodeUserFile(clients[ip]);

	    fs.writeFileSync(files.grid, encodePixelData(pixelData));
	    console.log("placed pixel at ("+x+", "+y+"), col "+col);
	}
	else console.log("no");
    });

    socket.on("disconnect", () => {
        console.log("disconnection from "+ip);
	delete clients[ip];
    });
});

server.listen(port, () => console.log("Listening on port "+port));
ready = true;
