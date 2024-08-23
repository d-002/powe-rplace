let interval;
let fps = 10;
let scale = 20;

let dom = {
    clouds: null,

    players: null,
    down: null,
    errors: null,
    lastError: null
};

let Data = {};
let handlers = {};

let cW, cH;
let clouds;

class CanvasHandler {
    constructor(canvas, w, h, data) {
        if (this.constructor == CanvasHandler) throw new Error("This is an abstract class");

        this.data = data;

        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        // resize canvas
        canvas.setAttribute("width", w);
        canvas.setAttribute("height", h);
        canvas.width = w;
        canvas.height = h;

        canvas.addEventListener("mousemove", evt => this.onmove(evt));
        canvas.addEventListener("mouseout", evt => this.redraw());
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class Graph extends CanvasHandler {
    constructor(canvas, data) {
        super(canvas, 40+47*16, 90+10, data);

        this.redraw();
    }

    point(x, y) {
        this.ctx.fillStyle = "#269742";
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, 2*Math.PI);
        this.ctx.fill();
    }

    redraw() {
        // background, scale
        this.clear();

        this.ctx.fillStyle = "#14d24320";
        this.ctx.fillRect(32, 2, 47*16 + 5, 86);

        const max = Math.max(...this.data) || 1;

        this.ctx.font = "16px pixelify, sans-serif";
        this.ctx.fillStyle = "#000";
        this.ctx.fillText(0, 5, 85+8);
        this.ctx.fillText(max, 5, 15+8);

        // background lines
        this.ctx.lineWidth = 1;

        [[15.5, "#f7fff75f"], [85.5, "#f7fff7"]].forEach(([y, col]) => {
            this.ctx.strokeStyle = col;
            this.ctx.beginPath();
            this.ctx.moveTo(35.5, y);
            this.ctx.lineTo(35.5 + 47*16, y);
            this.ctx.stroke();
        });
        for (let i = 0; i < 48; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(35.5 + 16*i, 5.5);
            this.ctx.lineTo(35.5 + 16*i, 85.5);
            this.ctx.stroke();
        }

        // fill in graph from data points
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = "#3eb65c";

        for (let i = 0; i < 47; i++) {
            const x1 = 35 + 16*i, x2 = 51 + 16*i;
            const d1 = this.data[i] == -1 ? -1 : this.data[i]/max;
            const d2 = this.data[i+1] == -1 ? -1 : this.data[i+1]/max;
            const y1 = 85 - 70*d1, y2 = 85 - 70*d2;

            if (d1 != -1 && d2 != -1) {
                this.ctx.fillStyle = "#14d24350";
                this.ctx.beginPath();
                this.ctx.moveTo(x2, y2);
                this.ctx.lineTo(x1, y1);
                this.ctx.stroke();
                this.ctx.lineTo(x1, 85);
                this.ctx.lineTo(x2, 85);
                this.ctx.fill();
            }

            if (y1 != -1) this.point(x1, y1);
            if (i == 47 && y2 != -1) this.point(x2, y2);
        }
    }

    onmove(evt) {
        this.redraw();
    }
}

class SquareGrid extends CanvasHandler {
    constructor(canvas, data, badness, key) {
        super(canvas, 10+48*16, 15+45, data);

        this.badness = badness; // converts a value into its badness (0->1)
        this.key = key; // array of either [[badness, alternate], "text"] (point) or [[[badness 1, alternate 1], [badness 2, alternate 2]], "text"] (gradient)
        this.redraw();
    }

    square(x, y, value, alternate) {
        if (value == -1) this.ctx.fillStyle = "#121211";
        else {
            value = this.badness(value);
            this.ctx.fillStyle = value ? alternate ? "rgb("+255*value+", 0, 255)" : "rgb(255, "+(255 - 255*value)+", 0)" : "#14d243";
        }

        this.ctx.fillRect(x, y, 15, 15);
        this.ctx.clearRect(x, y, 1, 1);
        this.ctx.clearRect(x+14, y, 1, 1);
        this.ctx.clearRect(x+14, y+14, 1, 1);
        this.ctx.clearRect(x, y+14, 1, 1);
    }

    redraw() {
        this.clear();

        // main part
        let x = 5;
        this.data.forEach(point => {
            this.square(x, 0, ...point);
            x += 16;
        });

        // key
        this.ctx.font = "16px pixelify, sans-serif";

        x = 5;
        this.key.forEach(([points, text]) => {
            if (points[0].length == null) {
                // single point
                this.square(x, 40, ...points);
                this.ctx.fillStyle = "#000";
                this.ctx.fillText(text, x+18, 53);
                x += 120;
            }
            else {
                // gradient, multiple points
                const [b1, a1] = points[0];
                const [b2, a2] = points[1];
                for (let i = 0; i < 4; i++) {
                    this.square(x, 40, b1 + (b2-b1)*i/3, a1 + (a2-a1)*i/3);
                    x += 16;
                }
                this.ctx.fillStyle = "#000";
                this.ctx.fillText(text, x+2, 53);
                x += 104;
            }
        });
    }

    onmove(evt) {
        this.redraw();
    }
}

function resizeCanvas(evt) {
    cW = window.innerWidth;
    cH = window.innerHeight;
    dom.clouds.width = cW;
    dom.clouds.height = cH;
}

const hour = 3600000;
let toHour = (time) => Math.floor(time/hour);

function parsePlayers() {
    let data = new Array(48).fill(-1);
    const now = toHour(Date.now());

    Data.players.forEach(line => {
        line = line.split(" ");
        let time = toHour(parseInt(line[0]));
        let n = parseInt(line[1]);
        let i = time-now+47;
        if (i >= 0 && i < 48) data[i] = n;
    });

    return data;
}

function parseDown() {
    let data = [];
    for (let i = 0; i < 48; i++) data.push([0, 0]);
    const now = toHour(Date.now());

    Data.down.forEach(line => {
        line = line.split(" ");
        const end = parseInt(line[0]);
        const duration = parseInt(line[1]);
        const start = end-duration;

        const hour1 = toHour(start);
        const hour2 = toHour(end);

        const startI = hour1-now+47;
        const endI = hour2-now+47;
        for (let i = startI; i <= endI; i++) {
            if (i < 0 || i > 47) continue;

            if (i == startI && i == endI) data[i][0] += duration/hour;
            else if (i == startI) data[i][0] += 1 - start/hour + hour1;
            else if (i == endI) data[i][0] += end/hour - hour2;
            else data[i][0] = 1;
            data[i][1] = parseInt(line[2]);
        }
    });

    return data;
}

function parseErrors() {
    let data = [];
    for (let i = 0; i < 48; i++) data.push([0, 0]);
    const now = toHour(Date.now());

    Data.errors.forEach(line => {
        const time = toHour(parseInt(line.substring(0, line.indexOf(" "))));
        const i = time-now+47;
        if (i >= 0 && i < 48) data[i][0]++;
    });

    return data;
}

function setScale(canvas, w, h) {
    canvas.setAttribute("width", w);
    canvas.setAttribute("height", h);
    canvas.width = w;
    canvas.height = h;
}

function init() {
    handlers.players = new Graph(dom.players, parsePlayers());
    handlers.down = new SquareGrid(dom.down, parseDown(), x => x, [[[0, 0], "Running"], [[[0.001, 0], [1, 0]], "Down"], [[[0.001, 1], [1, 1]], "Maintenance"]]);
    handlers.errors = new SquareGrid(dom.errors, parseErrors(), x => x ? 1 : 0, [[[0, 0], "No errors"], [[1, 0], "Error"]]);

    const error = Data.errors ? Data.errors[Data.errors.length-1] : ""
    dom.lastError.innerHTML = error.substring(error.indexOf(" ")+1).replaceAll("\t", "<br />");
}

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));

    // read data
    "players down errors".split(" ").forEach(name => {
        $.get(name+".txt", (d, _) => Data[name] = d.split("\n"));
    });

    // wait until all the data has been read
    const startInterval = window.setInterval(() => {
        if (Object.keys(Data).length == 3) {
            window.clearInterval(startInterval);
            init();
        }
    }, 100);

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    clouds = new Clouds();
    interval = window.setInterval(() => clouds.update(false), 1000/fps);
};
