let fs, files, dirs;
function initUser(_fs, _files, _dirs) {
    fs = _fs;
    files = _files;
    dirs = _dirs;
}

class User {
    constructor(ip, nColors, version, lastPixel, pixelCooldown) {
	// this.socket can be undefined if the object is only used as a container for its settings
	this.socket = undefined;

	this.ip = ip;
	this.nColors = nColors;
	this.version = version;
	this.lastPixel = lastPixel;
	this.pixelCooldown = pixelCooldown; // s
    }
}

function decodeUserFile(ip, baseNColors, baseCooldown) {
    // base values, will be overriden upon successful file load
    let nColors = baseNColors;
    let version = 0;
    let lastPixel = 0;
    let pixelCooldown = baseCooldown;

    if (fs.existsSync(dirs.accountsFolder+ip)) {
	try {
	    const lines = String(fs.readFileSync(path)).split("\n");
	    nColors = parseInt(lines[0]);
	    version = Number(lines[1]);
	    lastPixel = Number(lines[2]);
	    pixelCooldown = parseInt(lines[3]);
        }
	catch {
	    console.log("Error loading user file "+path);
        }
    }

    return new User(ip, nColors, version, lastPixel, pixelCooldown);
}

function encodeUserFile(user) {
    fs.writeFileSync(dirs.accountsFolder+user.ip, user.nColors+"\n"+user.version+"\n"+user.lastPixel+"\n"+user.pixelCooldown);
}

module.exports = { initUser, User, decodeUserFile, encodeUserFile };
