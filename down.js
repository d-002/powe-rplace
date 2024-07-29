const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const port = 8080;

// landing page
app.get("/", (req, res) => {
    res.sendFile(__dirname+"/down.html");
});

server.listen(port, () => console.log("Listening on port "+port));
