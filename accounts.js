let fs, files, dirs;
function initAccounts(_fs, _files, _dirs) {
    fs = _fs;
    files = _files;
    dirs = _dirs;
}

function canPlacePixel(user) {
    // check if the user is in cooldown: if so, it should be in the in cooldown file
    // also, parse the entire file and remove users from it that are no longer in cooldown
    let newContent = "";
    let result = true;

    String(fs.readFileSync(files.inCooldown)).split('\n').forEach(line => {
	const i = line.indexOf(" ");
	const prev = Number(line.substring(i+1));
	const inCooldown = Date.now()/1000 - prev < user.pixelCooldown || prev <= 0;

	if (inCooldown) {
	    if (user.ip == line.substring(0, i) && inCooldown) result = false;
	    if (newContent != "") newContent += "\n";
	    newContent += line;
	}
    });

    fs.writeFileSync(files.inCooldown, newContent);

    return result;
}

function placePixel(user) {
    user.lastPixel = Date.now()/1000;
}

module.exports = { initAccounts, canPlacePixel, placePixel };
