import { animate } from "./animated-bg.js";

let startTime;
let interval;
let link;
let fps = 60; // not affecting the countdown update

// error name: [info, link content, link address, initiate countdown (will override link content)]
const options = {
	"unknown": ["Unknown error.", "Back to homepage", "/", false],
	"starting": ["Server starting, please wait a few moments then refresh the page.", "", "/", true],
	"dupe-ip": ["A client with the same IP address has been detected. Please only join once per address.", "Back to homepage", "/", false],
	"timeout": ["You timed out. Please retry connecting.", "Back to homepage", "/", false],
	"maintenance": ["The server is momentarily down for maintenance. Our apologies for the inconvenience.", "Retry", "/", false]
}

let type = new URLSearchParams(window.location.search).get("reason") || "unknown";
if (!Object.keys(options).includes(type)) type = "unknown";

function update() {
	const t = Date.now() - startTime;

	if (t > 5000) {
		link.href = "/";
		link.innerHTML = "Refresh";
		window.clearInterval(interval);
		document.location.href = options[type][2];
	}
	else {
		const value = Math.ceil((5000-t) / 1000);
		const s = value == 1 ? "" : "s";
		link.innerHTML = "Or wait "+value+" second"+s+"...";
	}
}

window.onload = () => {
	const [info, linkContent, linkAddr, countdown] = options[type];
	document.getElementById("info").innerHTML = info;
	link = document.getElementById("link");

	if (countdown) {
		startTime = Date.now();
		interval = window.setInterval(update, 100);
	}
	else {
		link.innerHTML = linkContent;
		link.href = linkAddr;
	}

	animate(window, document.getElementById("canvas-bg"), fps);
}
