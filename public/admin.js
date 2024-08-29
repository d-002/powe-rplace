let socket = io();
let password;

let filesList;
let currentFile;
let loadingFile;

let dom = {
    tree: null,
    contents: null
};

function fillTree() {
    dom.tree.innerHTML = "";

    let fill = (list, parent, dirname) => {
        list.forEach(file => {
            const isDir = typeof file == "object";

            const elt = document.createElement("li");
            let name;
            if (isDir) {
                name = Object.keys(file)[0];
                elt.innerHTML = name;
            }
            else elt.innerHTML = file;
            parent.appendChild(elt);

            if (isDir) {
                elt.appendChild(document.createElement("ul"));
                fill(Object.values(file)[0], elt.children[0], dirname+name);
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

function editFile() {
    if (currentFile == null || loadingFile != null) return;
    socket.emit("editFile", [password, currentFile, dom.contents.value]);
}

socket.on("sendFileList", list => {
    filesList = list;
    fillTree();
});

socket.on("sendFileContents", data => {
    dom.contents.value = data;

    currentFile = loadingFile;
    loadingFile = null;
});

window.onload = () => {
    Object.keys(dom).forEach(id => dom[id] = document.getElementById(id));

    socket.emit("listFiles", password);
};
