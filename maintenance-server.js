const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);

const port = process.env.PORT || 3000;

console.log("Starting backup server... Maintenance on");

app.use(express.static(__dirname+"/public"));

app.get("/", (req, res) => {
    res.redirect("/down?reason=maintenance");
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(__dirname+"/public/img/icon/icon-16.ico");
});

app.get("/down", (req, res) => {
    res.sendFile(__dirname+"/down.html");
});

app.get("/terms", (req, res) => {
    res.sendFile(__dirname+"/terms.html");
});

app.get("/status", (req, res) => {
    res.sendFile(__dirname+"/status.html");
});

// error handling
process.on("uncaughtException", function (err) {
    console.error("PREVENTED SERVER CRASH, logging...");
    console.error(err.stack);
});

app.use((err, req, res, next) => {
    console.error("Non-critical error:");
    console.error(err.stack);

    res.redirect("/");
});

server.listen(port, () => console.log("Listening on port "+port));
