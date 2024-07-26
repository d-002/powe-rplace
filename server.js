const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const port = 8080;

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/index.html");
});

io.on("connection", socket => {
    console.log("user connected");

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
        console.log("user disconnected");
    });
});

server.listen(port, () => console.log("Listening on port "+port));
