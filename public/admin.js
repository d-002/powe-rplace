let socket = io();

let filesList;
let currentFile;
let loadingFile;
let wantTreeEdit = false;

let uneditedData;
let isBinary;

let dom = {
    login: null,
    username: null,
    password: null,
    loginComment: null,

    main: null,
    path: null,
    tree: null,
    contents: null,
    popup: null
};

let popupTimeout;
let disconnected = false;

function login() {
    socket.emit("login", [dom.username.value, dom.password.value]);
}

socket.on("loginFeedback", result => {
    console.log(result);
    if (result == 0) dom.loginComment.innerHTML = "Incorrect login details";
    else {
        if (result == 1) dom.loginComment.innerHTML = "First connection sucessful";
        else dom.loginComment.innerHTML = "Login successful";

        dom.username.value = "";
        dom.password.value = "";

        window.setTimeout(() => {
            socket.emit("listFiles");
            dom.login.style = "display: none";
            dom.main.style = "";
        }, 500);
    }
});

////////////////////

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
                elt.children[0].addEventListener("click", () => treeExpand(elt.children[1], dirname+name));

                fill(Object.values(file)[0], elt.children[1], dirname+name);
            }
            else elt.addEventListener("click", () => treeClick(dirname+file));
        });
    };

    fill(filesList, dom.tree, "");
}

function treeClick(path) {
    if (loadingFile != null) {
        popup("You can't do this right now.", 2);
        return;
    }

    dom.path.value = path;
    loadingFile = path;
    socket.emit("readFile", path);
}

function treeExpand(elt, path) {
    dom.path.value = path;
    elt.className = elt.className ? "" : "closed";
}

function refresh() {
    dom.path.value = "";
    dom.tree.innerHTML = "";
    dom.contents.value = "";
    socket.emit("listFiles");
}

let updateOp = () => socket.emit("updateOp");
let updateMtn = () => socket.emit("updateMaintenance");

function createPath() {
    wantTreeEdit = true;
    socket.emit("createPath", dom.path.value);
}

function deletePath() {
    wantTreeEdit = true;
    socket.emit("deletePath", dom.path.value);
}

function editFile() {
    const ok = currentFile != null && loadingFile == null;
    if (ok) {
        socket.emit("editFile", [currentFile, dom.contents.value]);
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
            socket.emit("editFile", [currentFile, data]);
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
};
