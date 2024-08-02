const { initAccounts, User, isInCooldown, userPlacePixel } = require(__dirname+"/accounts.js");
const { colors, colorsLengths, W, H, initMap, decodeMap, encodeMap, logPixelChange, makeClientUpdate, applyUpdate } = require(__dirname+"/public/map.js");

// files
const files = {
    "options": "/files/options.txt",
    "inCooldown": "/files/inCooldown.csv",
    "grid": "/files/grid.csv",
    "maintenance": "/files/maintenance.txt"
}
const dirs = {
    "logsFolder": "/files/logs/",
    "accountsFolder": "/files/accounts/"
}


// set up server
const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const port = process.env.PORT || 3000;

let clients = {}; // ip: User object

// execute certain actions once in a while, triggered when someone places a pixel
let prevBroadcast = Date.now();
const broadcastDelay = 10000;

// init modules
initAccounts(fs, files, dirs);
initMap(fs, files, dirs);

app.use(express.static(__dirname+"/public"));

let ready = false; // display loading page while not ready
let maintenance;

// landing page
app.get("/", (req, res) => {
    if (maintenance) {
	res.redirect("/down?reason=maintenance");
	checkMaintenance();
    }
    else if (ready) res.sendFile(__dirname+"/index.html");
    else res.redirect("/down?reason=starting");
});

app.get("/down", (req, res) => {
    // if maintenance just stopped, maybe that was the cause of the issue, try to fix
    if (checkMaintenance() && !maintenance) res.redirect("/");
    else res.sendFile(__dirname+"/down.html");
});

// create directories and files if non-existant
console.log("Checking files...");
const mainDir = __dirname+"/files";
if (!fs.existsSync(mainDir)) {
    fs.mkdirSync(mainDir);
    console.log("Created main dir");
}

Array.from(Object.keys(dirs)).forEach(name => {
    let dir = __dirname+dirs[name];
    dirs[name] = dir;

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
	console.log("Created dir "+dir);
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

checkMaintenance();

// read options
let logsVersion = 0; // increases by 1 every map edit, to apply changes to clients

const lines = String(fs.readFileSync(files.options)).split("\n");
try {
    let value = parseInt(lines[0]);
    if (!isNaN(value)) logsVersion = value;
}
catch(e) {
    console.log("Error while loading options: "+e);
}
console.log("Server version: "+logsVersion);

function updateOptions() {
    fs.writeFileSync(files.options, ""+logsVersion);
}
updateOptions();

console.log("Reading canvas array...");
let serverGrid = decodeMap(String(fs.readFileSync(files.grid)));

if (logsVersion == 0) {
    console.log("Writing initial grid to grid file");
    fs.writeFileSync(files.grid, encodeMap(serverGrid))
}


io.on("connection", socket => {
    let ip = (socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress).split(',')[0].split(":").slice(-1)[0];

    // check if a client with this ip already connected
    let ok = true;
    Object.keys(clients).forEach(ip2 => { if (ip == ip2) ok = false; });
    if (!ok) {
	console.error("Duplicate connection from "+ip);
	socket.emit("duplicateIp");
	return;
    }

    clients[ip] = User.decodeFile(ip, colorsLengths[0], 2000);
    clients[ip].socket = socket;
    console.log("New connection from "+ip);

    updateClientIp(ip, clients[ip].version);

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

	ok &= !isInCooldown(clients[ip]);

	socket.emit("pixelFeedback", (hash << 8) + (ok ? 0 : 1));
	if (ok)	{
	    serverGrid[y][x] = col;
	    logsVersion = logPixelChange(x, y, col, logsVersion);
	    userPlacePixel(clients[ip], logsVersion);

	    console.log("Placed pixel at ("+x+", "+y+"), col "+col);
	    clients[ip].encodeToFile();
	    updateOptions();

	    fs.writeFileSync(files.grid, encodeMap(serverGrid));
	}


	// execute code at certain time intervals, triggered here
	const now = Date.now();
	if (now - prevBroadcast > broadcastDelay) {
	    console.log("Broadcast")
	    prevBroadcast = now;
	    interval();
	}
    });

    socket.on("help", _ => {
	// triggered when the map in the user's local storage doesn't exist
	updateClientIp(ip, null);
    });

    socket.on("disconnect", () => {
        console.log("Disconnection from "+ip);
	delete clients[ip];
    });
});

function updateClientIp(ip, version) {
    const client = clients[ip];
    client.socket.emit("mapUpdate", makeClientUpdate(version, logsVersion, serverGrid));
    client.version = logsVersion;
    client.encodeToFile();
}

function interval() {
    Object.values(clients).forEach(user => {
	updateClientIp(user.ip, user.version);
    });

    checkMaintenance();
}

function checkMaintenance() {
    const value = Number(fs.readFileSync(files.maintenance));
    if (value != maintenance) {
	maintenance = value;
	console.log("Maintenance set to "+maintenance);

	// notify all clients
	if (maintenance) Object.values(clients).forEach(user => user.socket.emit("maintenance", maintenance));

	return true;
    }

    return false;
}

// error handling
process.on("uncaughtException", function (err) {
	console.log("PREVENTED SERVER CRASH, logging...");
	console.error(err);
});

server.listen(port, () => console.log("Listening on port "+port));
//ready = true;
