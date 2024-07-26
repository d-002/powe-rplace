const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const fs = require("fs");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const port = 8080;

let clients = {}; // ip: socket

app.use(express.static(__dirname + "/public"));

// landing page
app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

// files
const files = {
    'options': '/files/options.txt',
    'cooldown': '/files/inCooldown.csv',
    'logsVersion': '/files/logs/version.txt'
}
const dirs = {
    'logsFolder': '/files/logs/',
    'accountsFolder': '/files/accounts/'
}

// create directories and files if non-existant
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

io.on("connection", socket => {
    const ip = socket.handshake.address.address;
    clients[ip] = socket;
    console.log("new connection from "+ip);

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
	if (isNaN(x) || x < 0) ok = false;
	else if (isNaN(y) || y < 0) ok = false;

	if (ok)	console.log("placed pixel at ("+x+", "+y+"), col "+col);
	else console.log("no");

	if (x == y) ok = false;
	socket.emit("pixelFeedback", (hash << 8) + (ok ? 0 : 1));
    });

    socket.on("disconnect", () => {
        console.log("disconnection from "+ip);
	delete clients[ip];
    });
});

server.listen(port, () => console.log("Listening on port "+port));
