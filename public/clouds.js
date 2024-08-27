class Clouds {
    static n = 10;

    constructor() {
        this.images = [];
        this.pos = [];
        for (let i = 1; i <= 17; i++) {
            const image = new Image();
            image.src = "/img/clouds/"+i+".png";
            this.images.push(image);

            if (i <= Clouds.n)
                this.pos.push([Math.floor(Math.random()*17), Math.random()*(cW+50)-50, Math.random()*cH, Math.random()*10+1, 0, 0]);
        }

        this.pos = this.pos.sort((a,b) => a[3]-b[3]);
        this.ctx = dom.clouds.getContext("2d");
        this.ready = false;
        this.last = 0;
    }

    isReady() {
        for (let i = 0; i < this.images.length; i++) {
            if (this.images[i].complete) {
                if (i >= this.pos.length) continue;
                const j = this.pos[i][0];
                this.pos[i][4] = this.images[j].width;
                this.pos[i][5] = this.images[j].height;
            }
            else return false;
        }
        return true;
    }

    update(mainPage) {
        if (!this.ready) {
            this.ready = this.isReady();
            if (!this.ready) return;
        }

        if (Date.now()-this.last < 500) return;
        this.last = Date.now();

        if (mainPage) {
            // don't update when the clouds aren't visible
            const w = cW/scale/options.zoom;
            const h = cH/scale/options.zoom;

            if (options.x > w && options.x < W-w && options.y > h && options.y < H-h) return;
        }

        this.ctx.clearRect(0, 0, cW, cH);

        for (let i = 0; i < this.pos.length; i++) {
            let [j, x, y, step, width, height] = this.pos[i];
            x += step;

            let wrap = false;
            if (x < -width) {
                x += cW;
                wrap = true;
            }
            else if (x >= cW) {
                x -= cW+width;
                wrap = true;
            }

            if (wrap) y = Math.random()*cH;
            this.pos[i] = [j, x, y, step, width, height];

            this.ctx.drawImage(this.images[j], x, y, width, height);
        }
    }
}
