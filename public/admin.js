let socket = io();
let password;

let filesList;
let currentFile;
let loadingFile;
let wantTreeEdit = false;

let uneditedData;
let isBinary;

let dom = {
    path: null,
    tree: null,
    contents: null,
    popup: null
};

let popupTimeout;
let disconnected = false;

function popup(text, badness, err=null) {
    dom.popup.style.display = null;
    dom.popup.className = "reset-animation";
    dom.popup.offsetWidth;
    dom.popup.innerHTML = err == null ? text : text.substring(0, text.length-1)+", check logs.";
    dom.popup.className = ["green", "orange", "red"][badness];

    let t = [() => { dom.popup.style.display = "none"; }, 5000];
    if (popupTimeout == null) popupTimeout = window.setTimeout(...t);
    else {
        window.clearTimeout(popupTimeout);
        popupTimeout = window.setTimeout(...t);
    }

    if (err != null) console.error(text+"\n"+err);
}

function fillTree() {
    dom.tree.innerHTML = "";

    let fill = (list, parent, dirname) => {
        if (parent != dom.tree && parent != dom.tree.children[0].children[1])
            parent.className = "closed";
        list.forEach(file => {
            const isDir = typeof file == "object";

            const elt = document.createElement("li");
            let name;
            if (isDir) {
                name = Object.keys(file)[0];
                elt.innerHTML = "<p>"+name+"</p>";
            }
            else elt.innerHTML = "<span>"+file+"</span>";
            parent.appendChild(elt);

            if (isDir) {
                elt.appendChild(document.createElement("ul"));
                elt.children[0].addEventListener("click", treeExpand);

                fill(Object.values(file)[0], elt.children[1], dirname+name);
            }
            else elt.addEventListener("click", () => treeClick(dirname+file));
        });
    };

    fill(filesList, dom.tree, "");
}

function treeClick(path) {
    if (loadingFile != null) return;

    loadingFile = path;
    socket.emit("readFile", [password, path]);
}

function treeExpand() {
    // target the ul element, not the actually clicked p element
    let _this = this.nextSibling;
    _this.className = _this.className ? "" : "closed";
}

function refresh() {
    dom.tree.innerHTML = "";
    socket.emit("listFiles", password);
}

let updateOp = () => socket.emit("updateOp", password);
let updateMtn = () => socket.emit("updateMaintenance", password);

function createPath() {
    wantTreeEdit = true;
    socket.emit("createPath", [password, dom.path.value]);
}

function deletePath() {
    wantTreeEdit = true;
    socket.emit("deletePath", [password, dom.path.value]);
}

function editFile() {
    const ok = currentFile != null && loadingFile == null;
    if (ok) {
        socket.emit("editFile", [password, currentFile, dom.contents.value]);
        if (isBinary) popup("Edited file with textarea-corrupted characters, might cause issues.", 1);
    }
    else popup("Cannot edit the file right now", 2);
}

function uploadFile() {
    if (currentFile == null) {
        popup("Select a file first.", 2);
        return;
    }

    const input = document.createElement("input");
    input.style.display = "none";
    document.body.appendChild(input);
    input.type = "file";

    input.click();
    input.addEventListener("change", event => {
        input.remove();

        // load file
        const fr = new FileReader();
        fr.onload = evt => {
            const data = bufferToString(evt.target.result);
            onFileLoad(data);
            socket.emit("editFile", [password, currentFile, data]);
        }
        fr.readAsArrayBuffer(event.target.files[0]);
    });
}

function downloadFile() {
    if (currentFile == null || loadingFile != null) {
        popup("Cannot download right now", 2);
        return;
    }

    let name = currentFile.split("/");
    name = name[name.length-1].split("\\");
    name = name[name.length-1];

    if (isBinary) popup("Detected textarea-corrupted characters, downloaded unchanged content", 1);

    let elt = document.createElement("a");
    let url;
    if (isBinary) {
        const blob = new Blob([stringToBuffer(uneditedData)]);
        url = window.URL.createObjectURL(blob);
        elt.href = url;
    }
    else elt.href = "data:text/plain;charset=utf-8,"+encodeURIComponent(dom.contents.value);
    elt.setAttribute("download", name);

    elt.style.display = "none";
    document.body.appendChild(elt);
    elt.click();
    document.body.removeChild(elt);
    if (isBinary) window.URL.revokeObjectURL(url);
}

function stringToBuffer(s) {
    const sLen = s.length;
    let buf = new Uint8Array(sLen);

    for (let i = 0; i < sLen; i++) buf[i] = s.charCodeAt(i);

    return buf;
}

function bufferToString(buf) {
    let s = "";
    new Uint8Array(buf).forEach(i => s += String.fromCharCode(i));
    return s;
}

function onFileLoad(data, _isBinary) {
    dom.contents.value = data;

    // not really binary contents, but ones that will get changed in the textarea
    isBinary = data.includes("\r");
    if (isBinary) {
        popup("Detected textarea-corrupted characters", 1);
        uneditedData = data;
    }
}

socket.on("sendFileList", list => {
    filesList = list;
    fillTree();
    popup("Received files list", 0);
});

socket.on("acceptedFileRead", buf => {
    currentFile = loadingFile;
    loadingFile = null;

    onFileLoad(buf);
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

socket.on("acceptedOperation", () => {
    popup("Operation successful.", 0);

    if (wantTreeEdit) {
        wantTreeEdit = false;
        dom.path.value = "";
        refresh();
    }
});

socket.on("deniedOperation", (err) => {
    popup("Operation denied.", 2, err);
    if (wantTreeEdit) wantTreeEdit = false;
});

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));

    socket.emit("listFiles", password);
};
