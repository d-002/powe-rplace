import { animate } from "./animated-bg.js";

let startTime;
let interval;
let title, link;

let timer = 10000;

// error name: [title, subtitle, info, initiate countdown]
const options = {
    "unknown": ["Oops.", "", "Unknown error.", 0],
    "dupe-ip": ["501", "Not Implemented", "A client with the same IP address has been detected. Please only join once per address.", 0],
    "timeout": ["408", "Request Timeout", "You timed out. Please retry connecting.", 0],
    "disconnect": ["408", "Request Timeout", "Your connection with the server has been interrupted without warning. Our apologies for the inconvenience.", 0],
    "maintenance": ["503", "Service Unavailable", "The server is momentarily down for maintenance. Our apologies for the inconvenience.", 30000],
    "404": ["404", "Not Found", "The requested resource has not been found.", 0],
    "403": ["403", "Forbidden", "You are not authorized to view this resource.", 0]
}

let type = new URLSearchParams(window.location.search).get("reason") || "unknown";
if (!Object.keys(options).includes(type)) type = "unknown";

function update() {
    const t = Date.now() - startTime;

    if (t > timer) {
        link.href = "/";
        link.innerHTML = "Refresh";
        link.className = "";
        window.clearInterval(interval);
        document.location.href = "/";
    }
    else {
        const value = Math.ceil((timer-t) / 1000);
        const s = value == 1 ? "" : "s";
        link.innerHTML = "Or wait "+value+" second"+s+"...";
    }
}

window.onload = () => {
    const [title, subtitle, info, countdown] = options[type];
    timer = countdown;
    const id = i => document.getElementById(i);
    id("info").innerHTML = info;
    id("title").innerHTML = title;
    id("subtitle").innerHTML = subtitle;
    link = id("link");

    if (countdown) {
        startTime = Date.now();
        link.className = "nohref";
        interval = window.setInterval(update, 100);
    }
    else {
        link.innerHTML = "Back to homepage";
        link.href = "/";
    }

    animate(window, document.getElementById("canvas-bg"));
}
