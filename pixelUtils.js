const colors = ['white', 'red', 'blue', 'orange', 'green', 'yellow', 'purple', 'gray', 'black'];

const W = 10;
const H = 10;

function decodePixelData(data) {
    let pixels = [];

    if (data.length == W*H) {
	let x = W-1, y = -1;
	for (let i = 0; i < W*H; i++) {
	    if (++x == W) {
		x = 0;
		y++;
		pixels.push(new Array(W));
	    }

	    pixels[y][x] = data[i].charCodeAt(0);
	    if (isNaN(pixels[y][x])) pixels[y][x] = 0;
	}
    }

    if (pixels.length != H) {
	console.log("reset pixels");
	// white canvas if failed to load
        pixels = new Array(H).fill(null);
	for (let y = 0; y < H; y++) pixels[y] = new Array(W).fill(0);
    }

    return pixels;
}

function encodePixelData(pixels) {
    let data = "";
    for (let y = 0; y < pixels.length; y++) {
	let line = "";
	for (let x = 0; x < pixels[y].length; x++) line += String.fromCharCode(pixels[y][x]);
	data += line;
    }

    return data;
}

// module is manually set to null on the client to avoid errors
if (module != null) module.exports = { decodePixelData, encodePixelData, colors, W, H };
