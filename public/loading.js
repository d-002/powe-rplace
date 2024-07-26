let startTime;
let interval;
let link;

function update() {
	const t = Date.now() - startTime;

	if (t > 5000) {
		link.href = "/";
		link.innerHTML = "Refresh";
		window.clearInterval(interval);
		document.location.href = "/";
	}
	else {
		link.innerHTML = "Or wait "+Math.ceil((5000-t) / 1000)+" seconds...";
	}
}

window.onload = () => {
	link = document.getElementById("link");
	startTime = Date.now();
	interval = window.setInterval(update, 1000/30);
}