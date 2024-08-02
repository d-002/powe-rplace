let fs, files, dirs;
function initAccounts(_fs, _files, _dirs) {
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

    static decodeFile(ip, baseNColors, baseCooldown) {
	// base values, will be overriden upon successful file load
        let nColors = baseNColors;
        let version = 0;
        let lastPixel = 0;
        let pixelCooldown = baseCooldown;

        if (fs.existsSync(dirs.accountsFolder+ip)) {
	    try {
		const lines = String(fs.readFileSync(dirs.accountsFolder+ip)).split("\n");
		nColors = parseInt(lines[0]);
		version = Number(lines[1]);
		lastPixel = Number(lines[2]);
		pixelCooldown = parseInt(lines[3]);
            }
	    catch {
		console.log("Error loading user file "+ip);
	    }
	}

        return new User(ip, nColors, version, lastPixel, pixelCooldown);
    }

    encodeToFile() {
        fs.writeFileSync(dirs.accountsFolder+this.ip, this.nColors+"\n"+this.version+"\n"+this.lastPixel+"\n"+this.pixelCooldown);
    }
}

function isInCooldown(user) {
    // check if the user is in cooldown: if so, it should be in the in cooldown file
    // also, parse the entire file and remove users from it that are no longer in cooldown
    let newContent = "";
    let result = false;

    String(fs.readFileSync(files.inCooldown)).split('\n').forEach(line => {
	const i = line.indexOf(" ");
	const prev = Number(line.substring(i+1));
	const inCooldown = Date.now()/1000 - prev < user.pixelCooldown || prev <= 0;

	if (inCooldown) {
	    if (user.ip == line.substring(0, i) && inCooldown) result = true;
	    if (newContent != "") newContent += "\n";
	    newContent += line;
	}
    });

    fs.writeFileSync(files.inCooldown, newContent);

    return result;
}

function userPlacePixel(user, version) {
    user.lastPixel = Date.now()/1000;
    user.version = version;

    fs.appendFileSync(files.inCooldown, "\n"+user.ip+" "+user.lastPixel);
}

module.exports = { initAccounts, User, isInCooldown, userPlacePixel };
