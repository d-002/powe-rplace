let socket = io();
let password;

let filesList;
let currentFile;
let loadingFile;

let dom = {
    tree: null,
    contents: null,
    popup: null
};

let popupTimeout;
let disconnected = false;

function popup(text, badness) {
    dom.popup.style.display = null;
    dom.popup.className = "reset-animation";
    dom.popup.offsetWidth;
    dom.popup.innerHTML = text;
    dom.popup.className = ["green", "orange", "red"][badness];

    let t = [() => { dom.popup.style.display = "none"; }, 5000];
    if (popupTimeout == null) popupTimeout = window.setTimeout(...t);
    else {
        window.clearTimeout(popupTimeout);
        popupTimeout = window.setTimeout(...t);
    }
}

function fillTree() {
    dom.tree.innerHTML = "";

    let fill = (list, parent, dirname) => {
        list.forEach(file => {
            const isDir = typeof file == "object";

            const elt = document.createElement("li");
            let name;
            if (isDir) {
                name = Object.keys(file)[0];
                elt.innerHTML = "<p>"+name+"</p>";
            }
            else elt.innerHTML = file;
            parent.appendChild(elt);

            if (isDir) {
                elt.appendChild(document.createElement("ul"));
                elt.children[0].addEventListener("click", treeExpand);

                fill(Object.values(file)[0], elt.children[1], dirname+name);
            }
            else elt.addEventListener("click", () => treeClick(dirname+file));
        });
    };

    let container = document.createElement("ul");
    dom.tree.appendChild(container);
    fill(filesList, container, "");
}

function treeClick(path) {
    if (loadingFile != null) return;

    loadingFile = path;
    socket.emit("readFile", [password, path]);
}

function treeExpand() {
    this.className = this.className ? "" : "open";
}

function editFile() {
    const ok = currentFile != null && loadingFile == null;
    if (ok) socket.emit("editFile", [password, currentFile, dom.contents.value]);
    else popup("Cannot edit the file right now", 2);
}

socket.on("sendFileList", list => {
    filesList = list;
    fillTree();
    popup("Retrieved files list", 0);
});

socket.on("sendFileContents", ([data, isBinary]) => {
    dom.contents.value = data;

    if (isBinary) popup("Editing this binary file most likely will break it", 1);

    currentFile = loadingFile;
    loadingFile = null;
});

// does not work right now
socket.on("connection", () => {
    if (disconnected) {
        disconnected = false;
        popup("You are back online.", 0);
    }
});

socket.on("disconnect", () => {
    popup("You disconnected.", 1);
    disconnected = true;
});

socket.on("deniedFileEdit", () => popup("Unauthorized operation.", 2));
socket.on("successFileEdit", () => popup("File edited.", 0));

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));

    socket.emit("listFiles", password);
};
