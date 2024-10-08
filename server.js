const { initAccounts, privileges, User } = require(__dirname+"/public/accounts.js");
const { colors, W, H, initMap, decodeMap, encodeMap, logPixelChange, makeClientUpdate, applyUpdate } = require(__dirname+"/public/map.js");

// files
const files = {
    "options": "/files/options.txt",
    "grid": "/files/grid.csv",

    "blacklist": "/files/blacklist.txt",
    "op": "/files/op.txt",

    "maintenance": "/files/maintenance.txt", // contains either 0 or 1
    "ping": "/files/ping.txt",

    "nPlayers": "/public/status/players.txt",
    "down": "/public/status/down.txt",
    "errors": "/public/status/errors.txt"
}
const dirs = {
    "logs": "/files/logs/",
    "accounts": "/files/accounts/",
    "status": "/public/status"
}

console.log("Importing express...");
const express = require("express");
console.log("Setting up server...");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);
const helmet = require("helmet");
const bcrypt = require("bcrypt");

const salt = bcrypt.genSaltSync(10);

const { Server } = require("socket.io");
const io = new Server(server);

const port = process.env.PORT || 3000;

let clients = {}; // ip: User object
let prevClientsLength;

let blacklist = [];
let op = [];

// execute certain actions once in a while, triggered when someone places a pixel
let prevBroadcast = Date.now();
const broadcastDelay = 60000;

let maintenance;

let handleErr = err => { if (err) onError(err) };

// init modules
initAccounts(fs, files, dirs, handleErr);
initMap(fs, files, dirs);

app.use(express.static(__dirname+"/public"));

// landing page
app.get("/", (req, res) => {
    if (maintenance) {
        res.redirect("/down?reason=maintenance");
        checkMaintenance();
    }
    else res.sendFile(__dirname+"/index.html");
});

app.get("/favicon.ico", (req, res) => {
    res.sendFile(__dirname+"/public/img/icon/favicon.ico");
});

app.get("/admin", (req, res) => {
    res.sendFile(__dirname+"/admin.html");
});

app.get("/down", (req, res) => {
    // if maintenance just stopped, maybe that was the cause of the issue, try to fix
    if (checkMaintenance() && !maintenance) res.redirect("/");
    else res.sendFile(__dirname+"/down.html");
});

app.get("/status", (req, res) => {
    res.sendFile(__dirname+"/status.html");
});

app.get("/terms", (req, res) => {
    res.sendFile(__dirname+"/terms.html");
});

app.use(helmet());
app.use(function(req, res, next) {
    if (req.url == "/" || req.url == "/down" || req.url.startsWith("/down?")) next();
    else {
        res.status(404);
        res.redirect("/down?reason=404")
    }
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

function addDataToStatusFile(file, add) {
    let data = [];
    String(fs.readFileSync(file)).split("\n").forEach(line => {
        const timestamp = parseInt(line.split(" ")[0]) || 0;
        if (Date.now()-timestamp <= 127800000) data.push(line);
    });
    data.push(add);
    fs.writeFile(file, data.join("\n"), handleErr);
}

// check for server stops
const pingData = String(fs.readFileSync(files.ping)).split(" ");
let prevPing = parseInt(pingData[0]);
if (!prevPing) {
    console.log("Empty prev ping: "+prevPing);
    prevPing = Date.now();
}
let maintenanceThen = parseInt(pingData[1]) || 0;
addDataToStatusFile(files.down, Date.now()+" "+(Date.now()-prevPing)+" "+(maintenance + maintenanceThen ? 1 : 0));

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
    fs.writeFile(files.options, ""+logsVersion, handleErr);
}
updateOptions();

console.log("Reading canvas array...");
let serverGrid = decodeMap(String(fs.readFileSync(files.grid)), true);

if (logsVersion == 0) {
    console.log("Writing initial grid to grid file");
    fs.writeFileSync(files.grid, encodeMap(serverGrid))
}

io.on("connection", socket => {
    const ip = (socket.handshake.headers["x-forwarded-for"] || socket.conn.remoteAddress).split(",")[0].split(":").slice(-1)[0];
    
    if (blacklist.includes(ip)) {
        console.log("Blacklisted IP, disconencting");
        socket.emit("blacklist");

        return;
    }

    // check if a client with this ip already connected
    let dupe;
    Object.keys(clients).forEach(ip2 => {
        if (ip == ip2) {
            dupe = clients[ip].socket;
            clients[ip].isDupe = true;
        }
    });

    const user = User.decodeFile(ip)
    clients[ip] = user;
    user.isDupe = dupe != null;
    user.socket = socket;
    console.log("New connection from "+ip);

    if (dupe) {
        console.warn("Duplicate connection from "+ip+", disconnecting others");
        dupe.emit("duplicateIp");
    }

    socket.emit("connection"); // for admin page
    let login, password;

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
            updateClientIp(ip, user.version, false);
            user.version = ++logsVersion;

            console.log("Placed pixel at ("+x+", "+y+"), col "+col);
            updateOptions();
        }

        // execute code at certain time intervals, triggered here
        const now = Date.now();
        if (now - prevBroadcast > broadcastDelay) {
            prevBroadcast = now;
            broadcast(user);
        }
    });

    socket.on("initial", () => {
        // triggered on init, but should be fine to call it afterwards
        // forces a "normal" update of the map
        updateClientIp(ip, user.version, false);
        socket.emit("userUpdate", user.encode());
        socket.emit("nClients", Object.keys(clients).length);
    });

    socket.on("help", () => {
        // triggered when the map in the user's local storage is corrupted
        if (Date.now()-user.lastHelp > privileges.helpCooldown) {
            user.lastHelp = Date.now();
            updateClientIp(ip, null, false);
        }
        else socket.emit("noHelp");
    });

    socket.on("disconnect", () => {
        console.log("Disconnection from "+ip);
        socket.disconnect();
        socket.removeAllListeners();
        socket = null;

        user.encodeToFile();
        // don't delete client from storage if it was an older clone ip
        if (clients[ip].isDupe) clients[ip].isDupe = false;
        else delete clients[ip];
    });

    // op options
    socket.on("login", ([_login, _password]) => {
        const result = authorized(_login, _password);
        login = _login;
        password = _password;
        socket.emit("loginFeedback", result);
    });

    socket.on("updateOp", () => {
        const ok = authorized(login, password);

        if (ok) {
            updateOp();
            socket.emit("acceptedOperation");
        }
        else socket.emit("deniedOperation");
    });

    socket.on("updateMaintenance", () => {
        const ok = authorized(login, password);

        if (ok) {
            checkMaintenance();
            socket.emit("acceptedOperation");
        }
        else socket.emit("deniedOperation");
    });

    socket.on("listFiles", () => {
        if (!authorized(login, password)) {
            socket.emit("deniedOperation");
            return;
        }

        const ignore = [".git", "node_modules"];

        let fn = (a, b) => a == b ? 0 : a.toLowerCase() < b.toLowerCase() ? -1 : 1;
        let parse = (parent, dir) => {
            let list = [];
            fs.readdirSync(parent+dir).sort(fn).forEach(file => {
                if (ignore.includes(file)) return;

                if (fs.lstatSync(parent+dir+file).isDirectory()) {
                    if ("..".includes(file)) return;
                    list.push(parse(parent+dir, file+"/"));
                }
                else list.push(file);
            });

            let o = {};
            o[dir] = list;
            return o;
        };

        let parsed = [parse("", __dirname+"/")];
        // don't share information about __dirname for security reasons
        parsed[0] = {"/": Object.values(parsed[0])[0]};
        socket.emit("sendFileList", parsed);
    });

    socket.on("readFile", path => {
        if (!authorized(login, password)) {
            socket.emit("deniedOperation");
            return;
        }

        try {
            socket.emit("acceptedFileRead", fs.readFileSync(__dirname+path, { encoding: "binary" }));
        }
        catch(err) {
            console.log("Non-critical admin error:");
            console.error(err);
            socket.emit("deniedOperation", err.stack);
        }
    });

    // /!\ SENSITIVE FUNCTION
    socket.on("editFile", ([path, content]) => {
        executeOperation(socket, login, password, path, () => {
            fs.writeFile(__dirname+path, content, { encoding: "binary" }, handleErr);
        });
    });

    // /!\ SENSITIVE FUNCTION
    socket.on("createPath", path => {
        path = path.trim();
        if (path != null && path[0] != "/") path = "/"+path;
        executeOperation(socket, login, password, path, () => {
            path = __dirname+path;

            const isDir = path[path.length-1] == "/";
            if (isDir) fs.mkdirSync(path);
            else fs.writeFileSync(path, "");

            console.log("Created "+(isDir ? "dir" : "file")+": '"+path+"'");
        });
    });

    // /!\ SENSITIVE FUNCTION
    socket.on("deletePath", path => {
        path = path.trim();
        if (path != null && path[0] != "/") path = "/"+path;

        // don't allow to delete specific files
        if (path == "/") socket.emit("deniedOperation", "Can't delete root directory");
        else
            executeOperation(socket, login, password, path, () => {
                path = __dirname+path;

                const isDir = fs.lstatSync(path).isDirectory();
                if (isDir) fs.rmdirSync(path);
                else fs.unlinkSync(path);

                console.log("Deleted "+(isDir ? "dir" : "file")+": '"+path+"'");
            });
    });
});

function executeOperation(socket, login, password, path, operation) {
    if (!authorized(login, password)) {
        socket.emit("deniedOperation");
        return;
    }

    let err;
    try {
        err = String(path).includes("..") ? "Path cannot contain '..'" : path ? 0 : "Path cannot be null";
        if (err == 0) {
            operation();
            socket.emit("acceptedOperation");
        }
    }
    catch(e) {
        err = e;
        console.log("Non-critical admin error:");
        console.error(err);
    }
    if (err) socket.emit("deniedOperation", err.stack);
}

function authorized(login, password) {
    // returns 0 if not authorized, 1 if op but no password set, 2 if correct password
    // if 1, sets the password permanently

    let ok = 0;
    let i = 0;
    op.forEach(([_login, _hash]) => {
        if (_login == login) {
            if (_hash == null) {
                ok = 1;
                const hash = bcrypt.hashSync(password, salt);
                op[i] = [login, hash];

                updateOpFile();
            }
            else ok = bcrypt.compareSync(password, _hash) ? 2 : 0;
        }
        i++;
    });
    return ok;
}

function updateClientIp(ip, clientVersion, save=true) {
    const client = clients[ip];
    const [lengthy, data] = makeClientUpdate(clientVersion, logsVersion, serverGrid);
    client.socket.emit("mapUpdate", data);
    client.version = logsVersion;
    if (save || (lengthy && clientVersion != null)) client.encodeToFile();
}

function broadcast(ignore) {
    console.log("Broadcast");

    const values = Object.values(clients);
    values.forEach(user => {
        if (user == ignore) return;
        updateClientIp(user.ip, user.version);
    });
    const l = values.length;
    if (l != prevClientsLength) {
        prevClientsLength = l;

        values.forEach(user => user.socket.emit("nClients", l));
    }
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

function updateOp(forceLog=false) {
    // parses data from the op and blacklist files

    const _blacklist = blacklist.length;
    const _op = op.length;

    blacklist = String(fs.readFileSync(files.blacklist)).split("\n");
    op = String(fs.readFileSync(files.op)).split("\n");
    for (let i = 0, len = op.length; i < len; i++) {
        const j = op[i].indexOf(" ");
        if (j == -1) op[i] = [op[i], null];
        else op[i] = [op[i].slice(0, j), op[i].slice(j+1)];
    }

    if (_blacklist != blacklist.length && blacklist.length || forceLog) console.log("BLacklisted:\n"+blacklist);
    if (_op != op.length && op.length || forceLog) console.log("Op:\n"+op);
}
updateOp(true);

function updateOpFile() {
    // only updates the op file

    let list = [];
    op.forEach(([login, hash]) => list.push(login+" "+hash));
    fs.writeFile(files.op, list.join("\n"), handleErr);
}

// error handling
function logErrorToFile(err) {
    // not using replaceAll because of glitch.com
    addDataToStatusFile(files.errors, Date.now()+" "+err.stack.replace(/\t/g, "    ").replace(/\n/g, "\t"));
}

process.on("uncaughtException", onError);

function onError(err) {
    console.error("PREVENTED SERVER CRASH, logging...");
    console.error(err.stack);

    // log error in log files
    try {
        logErrorToFile(err);
    }
    catch {
        // make sure to not trigger errors here as this would loop
    }
}

app.use((err, req, res, next) => {
    try {
        console.error("Non-critical error:");
        console.error(err.stack);

        logErrorToFile(err);

        res.redirect("/down?reason=500");
    }
    catch(err) {
        console.error("VERY BAD ERROR, using default error handler");
        console.error(err.stack);

        if (res.headersSent) return next();

        res.status(500);
        res.send("<h1>Error</h1><p>"+err.stack.split("\n").join("<br />")+"</p>");
    }
});

// for play time updates, in case the server crashes
const slowInterval = setInterval(() => {
    Object.values(clients).forEach(user => user.encodeToFile());

    updateOp();
    checkMaintenance();

    // ping
    fs.writeFile(files.ping, Date.now()+" "+maintenance, handleErr);

    // update players file
    let toHour = time => Math.floor(time/3600000)*3600000;
    const hour = toHour(Date.now());
    const count = Object.keys(clients).length;
    let add = true;
    let data = [];
    String(fs.readFileSync(files.nPlayers)).split("\n").forEach(line => {
        line = line.split(" ");
        const timestamp = parseInt(line[0]) || 0;
        if (Date.now()-timestamp <= 127800000) {
            if (toHour(timestamp) == hour) {
                // store the peak number of players every hour...
                if (parseInt(line[1]) < count) line[1] = count;
                add = false;
            }
            data.push(line[0]+" "+line[1]);
        }
    });

    // ...or add a new data point on new hours
    if (add) data.push(hour+" "+count);
    fs.writeFile(files.nPlayers, data.join("\n"), handleErr);
}, broadcastDelay);

server.listen(port, () => console.log("Listening on port "+port));
