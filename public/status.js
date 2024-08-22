let data = {};

function init() {
}

window.onload = () => {
    // read data
    $.get("players.txt", (d, _) => data.players = d.split("\n"));
    $.get("down.txt", (d, _) => data.down = d.split("\n"));
    $.get("errors.txt", (d, _) => data.errors = d.split("\n"));

    // wait until all the data has been read
    const startInterval = window.setInterval(() => {
        if (Object.keys(data).length == 3) {
            window.clearInterval(startInterval);
            init();
        }
    }, 100);
};
