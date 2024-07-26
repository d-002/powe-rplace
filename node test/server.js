/*const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 500;
            res.end('Error loading index.html');
        } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end(data);
        }
    });
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
}*/

/*const WebSocketServer = require('ws');
const http = require('http');

const server = http.createServer(function(request, response) {});

server.listen(8080, function() { });

// create the server
wsServer = new WebSocketServer({
   httpServer: server
});

// WebSocket server
wsServer.on('request', function(request) {
   var connection = request.accept(null, request.origin);

   connection.on('message', function(message) {
       console.log(message);
   });
});*/

/*const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const server = new WebSocket.Server({ port: 8080 });

server.on("connection", (socket) => {
    console.log(socket);
	socket.send("hello world");

    socket.on("message", (message) => {
        console.log(socket);
		console.log(message);
    });
});

console.log(`Server running at http://${server.options.host}:${server.options.port}/`);*/

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

io.on("connection", socket =>{
    console.log("user connected");

	socket.on("message", (message) => {
		io.emit("message", message);
		console.log("echoed message "+message);
	});

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

server.listen(port, () => console.log("Listening on port "+port));
