const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const port = process.env.PORT || 3000;

console.log("Starting backup server... Maintenance on");

app.use(express.static(__dirname+"/public"));

app.get("/", (req, res) => {
    res.redirect("/down?reason=maintenance");
});

app.get("/down", (req, res) => {
    res.sendFile(__dirname+"/down.html");
});

// error handling
process.on("uncaughtException", function (err) {
    console.log("PREVENTED SERVER CRASH, logging...");
    console.error(err);
});

server.listen(port, () => console.log("Listening on port "+port));
