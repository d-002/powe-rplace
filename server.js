const { initAccounts, privileges, User } = require(__dirname+"/public/accounts.js");
const { colors, W, H, initMap, decodeMap, encodeMap, logPixelChange, makeClientUpdate, applyUpdate } = require(__dirname+"/public/map.js");

// files
const files = {
    "options": "/files/options.txt",
    "grid": "/files/grid.csv",
    "maintenance": "/files/maintenance.txt"
}
const dirs = {
    "logs": "/files/logs/",
    "accounts": "/files/accounts/"
}


console.log("Setting up server...");
const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);
const helmet = require('helmet');

const { Server } = require("socket.io");
const io = new Server(server);

const port = process.env.PORT || 3000;

let clients = {}; // ip: User object

// execute certain actions once in a while, triggered when someone places a pixel
let prevBroadcast = Date.now();
const broadcastDelay = 60000;

// init modules
initAccounts(fs, files, dirs);
initMap(fs, files, dirs);

app.use(express.static(__dirname+"/public"));
/*app.use(helmet());
app.use(function(req, res, next) {
    if (req.url == "/" || req.url == "/down" || req.url.startsWith("/down?")) next();
    else {
        res.status(404);
        res.redirect("/down?reason=404")
    }
});*/

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

// create dummy file to make the glitch.com editor display the logs folder
fs.writeFileSync(dirs.logs+"foo.txt", "bar");

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
let serverGrid = decodeMap(String(fs.readFileSync(files.grid)), true);

if (logsVersion == 0) {
    console.log("Writing initial grid to grid file");
    fs.writeFileSync(files.grid, encodeMap(serverGrid))
}

io.on("connection", socket => {
    let ip = (socket.handshake.headers["x-forwarded-for"] || socket.conn.remoteAddress).split(",")[0].split(":").slice(-1)[0];
    //ip += "-"+Date.now()%1000;

    // check if a client with this ip already connected
    let ok = true;
    Object.keys(clients).forEach(ip2 => {
        if (ip == ip2) ok = false;
    });
    if (!ok) {
        console.error("Duplicate connection from "+ip);
        socket.emit("duplicateIp");
        return;
    }

    const user = User.decodeFile(ip)
    clients[ip] = user;
    user.socket = socket;
    console.log("New connection from "+ip);

    socket.on("error", err => console.error("Error in socket: "+err));

    socket.on("placePixel", message => {
        // parse request, check if correct
        let ok = true;
        let x, y, col, hash;

        let s = message.split(".");
        if (s.length == 4) {
            x = parseInt(s[0]);
            y = parseInt(s[1]);
            col = parseInt(s[2]);
            hash = s[3];
        }
        else ok = false;
        if (isNaN(x) || x < 0 || x >= W) ok = false;
        else if (isNaN(y) || y < 0 || y >= H) ok = false;
        else if (isNaN(col)) ok = false;

        ok &= Date.now()-user.lastPixel >= user.pixelCooldown;

        // tell the user if the placement was authorized
        socket.emit("pixelFeedback", String.fromCharCode(ok ? 0 : 1)+hash);
        if (ok) {
            serverGrid[y][x] = col;
            logPixelChange(x, y, col, logsVersion);
            fs.writeFileSync(files.grid, encodeMap(serverGrid));

            user.lastPixel = Date.now();
            user.nPlaced++;
            // update the current user (tell about changes that happened since last broadcast)
            updateClientIp(ip, user.version);
            user.version = ++logsVersion;

            console.log("Placed pixel at ("+x+", "+y+"), col "+col);
            updateOptions();
        }

        // execute code at certain time intervals, triggered here
        const now = Date.now();
        if (now - prevBroadcast > broadcastDelay) {
            console.log("Broadcast")
            prevBroadcast = now;
            interval(user);
        }
    });

    socket.on("initial", _ => {
        // triggered on init, should be fine afterwards, forces a "normal" update of the map
        updateClientIp(ip, user.version);
        socket.emit("userUpdate", user.encode());
    });

    socket.on("help", _ => {
        // triggered when the map in the user's local storage doesn't exist
        if (Date.now()-user.lastHelp > privileges.helpCooldown) {
            user.lastHelp = Date.now();
            updateClientIp(ip, null);
        }
        else socket.emit("noHelp");
    });

    socket.on("disconnect", () => {
        console.log("Disconnection from "+ip);
        socket.disconnect();
        socket.removeAllListeners();
        socket = null;
        delete clients[ip];
    });
});

function updateClientIp(ip, clientVersion) {
    const client = clients[ip];
    client.socket.emit("mapUpdate", makeClientUpdate(clientVersion, logsVersion, serverGrid));
    client.version = logsVersion;
    client.encodeToFile();
}

function interval(ignore) {
    Object.values(clients).forEach(user => {
        if (user == ignore) return;
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
ready = true;
