// using fs2 instead of fs because multiple fs get defined on the client
let fs2, files2, dirs2;
function initAccounts(_fs, _files, _dirs) {
    fs2 = _fs;
    files2 = _files;
    dirs2 = _dirs;
}

// users and powerups settings
const privileges = {
    "colors": [8, 16, 24],
    "cooldown": [10000],

    // other options, not included in User objects, but exported into other scripts as well
    "helpCooldown": 5000,
    "timeoutDelay": 10000 // only used on the client, to guess when it has been disconnected
}

class User {
    constructor(ip, version, lastPixel, lastHelp, nPlaced, playTime) {
        // server-side variables, stay undefined client-side
        this.socket = undefined;
        this.isDupe = false;
        this.startTime = Date.now();

        this.ip = ip;
        this.version = version;
        this.lastPixel = lastPixel;
        this.lastHelp = lastHelp;

        this.nPlaced = nPlaced;

        this.playTime = playTime;

        // build privileges from stats
        this.nColors = privileges.colors[Math.min(parseInt(nPlaced/100), 2)];
        this.pixelCooldown = privileges.cooldown[0];
    }

    static decodeFile(ip) {
        return User.decodeString(ip, fs2.existsSync(dirs2.accounts+ip) ? String(fs2.readFileSync(dirs2.accounts+ip)) : "");
    }

    static decodeString(ip, data) {
        // base values, will be overriden upon successful load of data
        let version = 0;
        let lastPixel = 0;
        let lastHelp = 0;
        let nPlaced = 0;
        let playTime = 0;

        try {
            const lines = data.split("\n");
            version = Number(lines[1]) || 0;
            lastPixel = Number(lines[2]) || 0;
            lastHelp = Number(lines[3]) || 0;
            nPlaced = parseInt(lines[4]) || 0;
            playTime = Number(lines[5]) || 0;
        }
        catch (err) {
            console.error("Error loading user file "+ip+": "+err);
        }

        return new User(ip, version, lastPixel, lastHelp, nPlaced, playTime);
    }

    getPlayTime() {
        return Date.now()-this.startTime + this.playTime;
    }

    encode() {
        return this.nColors+"\n"+this.version+"\n"+this.lastPixel+"\n"+this.lastHelp+"\n"+this.nPlaced+"\n"+this.getPlayTime();
    }

    encodeToFile() {
        fs2.writeFileSync(dirs2.accounts+this.ip, this.encode());
    }
}

if (module != null) module.exports = { initAccounts, privileges, User };
