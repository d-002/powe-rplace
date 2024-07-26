let ul, input;
let socket = io();

socket.on("message", (message) => {
	console.log("received "+message);
	let li = document.createElement("li");
	li.innerHTML = message;
	ul.appendChild(li);
});

function click() {
	console.log("send "+input.value);
	socket.emit("message", input.value);
	input.value = "";
}

function init() {
	ul = document.getElementById("ul");
	input = document.getElementById("input");
	
	document.getElementById("btn").addEventListener("click", click);
}