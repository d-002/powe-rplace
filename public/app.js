let ctx;
let cW, cH;

let dom = {
    canvas: null,
    colors: null,
    info: null
}

function resizeCanvas(evt) {
    cW = window.innerWidth;
    cH = window.innerHeight;
    dom.canvas.width = cW;
    dom.canvas.height = cH;

    if (evt != null) updateAllCanvas();
}

function drawPixel(x, y, col) {
    localGrid[y][x] = col;
    ctx.fillStyle = colors[col];
    const size = scale*options.zoom;
    const _x = (x+options.x)*size, _y = (y+options.y)*size;
    ctx.fillRect(_x, _y, size-1, size-1);
}

function updateAllCanvas() {
    ctx.clearRect(0, 0, cW, cH);

    for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++)
        drawPixel(x, y, localGrid[y][x]);
}

function showInfo(message) {
    console.warn(message);
    dom.info.innerHTML = message;
}

function update() {
    appUpdate();
    clientScriptUpdate();
}

function appUpdate() {
}

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));
    ctx = dom.canvas.getContext("2d");
    resizeCanvas(null);
    loadLocalStorage();

    dom.canvas.addEventListener("click", click);
    window.addEventListener("resize", resizeCanvas);

    document.addEventListener("keydown", () => { options.color = (options.color+1) % colors.length });

    interval = window.setInterval(update, 100);

    socket.emit("initial");
}
