"use strict";
/// <reference path="./cbmloader.ts" />
/// <reference path="./events.ts" />
const DEFAULT_BAUD_RATE = 115200;
const PROGRAM_SEARCH_URL = "https://www.google.com/search?q="; //Used on image artwork click
const MEDIA_ALLOWED = ["d64", "prg", "t64"];
// Elements
const mediaPickIcon = document.getElementById('mediaPickIcon');
const connectIcon = document.getElementById('connectIcon');
const webIcon = document.getElementById('webIcon');
const folderPicker = document.getElementById('folderPicker');
const logoImg = document.getElementById('logoImg');
const tabsContainer = document.getElementById('tabsContainer');
const mediaSelect = document.getElementById('mediaSelect');
const searchInput = document.getElementById('searchInput');
const titleDiv = document.getElementById('titleDiv');
const progressBarDiv = document.getElementById('progressBarDiv');
const progressDiv = document.getElementById('progressDiv');
const artImg = document.getElementById('artImg');
const receivedMsgDiv = document.getElementById('receivedMsgDiv');
const directoryDiv = document.getElementById('directoryDiv');
const infoDiv = document.getElementById('infoDiv');
let library = new Map();
let currentGroupName = null;
let objLoader;
let testMode = false;
mediaPickIcon.onclick = () => folderPicker.click();
folderPicker.onchange = (e) => {
    const target = e.target;
    const files = Array.from(target.files || []);
    if (files.length === 0)
        return;
    library.clear();
    resetElements();
    files.forEach(async (file) => {
        const pathParts = file.webkitRelativePath.split('/');
        if (pathParts.length < 2)
            return;
        const groupName = pathParts[1];
        if (!library.has(groupName)) {
            library.set(groupName, { media: new Map(), art: new Map(), info: new Map() });
        }
        const groupData = library.get(groupName);
        const fileName = file.name.toLowerCase();
        const extension = fileName.split('.').pop()?.toLowerCase();
        if (pathParts.includes('art') && extension == 'jpg') {
            groupData.art.set(file.name, file);
        }
        else if (!file.name.startsWith('.') && MEDIA_ALLOWED.includes(extension)) {
            groupData.media.set(file.name, file);
        }
        else if (pathParts.includes('info') && fileName == `info_${groupName}.json`) {
            //Will only be one JSON file per group
            if (file && file.type === "application/json") {
                try {
                    const data = JSON.parse(await file.text());
                    for (const [filename, infoText] of Object.entries(data)) {
                        groupData.info.set(filename, infoText);
                    }
                }
                catch (err) {
                    console.error("Failed to process JSON file:", err);
                }
            }
        }
    });
    renderTabs();
};
function renderTabs() {
    tabsContainer.innerHTML = '';
    mediaPickIcon.src = "./resources/files-empty.png";
    const sortedGroups = Array.from(library.keys()).sort();
    sortedGroups.forEach(groupName => {
        const group = library.get(groupName);
        if (group.media.size === 0)
            return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.innerText = `${groupName} (${group.media.size})`;
        btn.onclick = () => selectGroup(groupName, btn);
        tabsContainer.appendChild(btn);
    });
    if (tabsContainer.innerHTML != '') {
        mediaPickIcon.src = "./resources/files-available.png";
    }
}
function selectGroup(groupName, btn) {
    currentGroupName = groupName;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    logoImg.src = `./resources/logo_${currentGroupName}.png`;
    searchInput.disabled = false;
    searchInput.value = '';
    resetElements();
    renderMediaList();
}
searchInput.oninput = () => {
    renderMediaList(searchInput.value.toLowerCase());
};
function resetElements() {
    artImg.style.display = "none";
    artImg.classList.remove("fade");
    artImg.classList.add("show");
    titleDiv.innerText = "";
    infoDiv.innerText = "";
    progressBarDiv.style.display = "none";
    directoryDiv.style.display = "none";
    directoryDiv.innerHTML = "";
    receivedMsgDiv.innerHTML = "";
}
function renderMediaList(filter = '') {
    mediaSelect.innerHTML = '';
    if (!currentGroupName)
        return;
    const group = library.get(currentGroupName);
    const mediaNames = Array.from(group.media.keys()).sort();
    mediaNames.forEach(name => {
        if (name.toLowerCase().includes(filter)) {
            mediaSelect.add(new Option(name, name));
        }
    });
}
mediaSelect.onchange = () => {
    if (!currentGroupName)
        return;
    const group = library.get(currentGroupName);
    const mediaName = mediaSelect.value;
    const baseName = mediaName.split(".")[0];
    const expectedArt = `${baseName}-image.jpg`;
    const artFile = group.art.get(expectedArt);
    titleDiv.innerText = baseName;
    infoDiv.innerText = group.info.get(mediaName) || "";
    progressDiv.style.width = "0%";
    progressBarDiv.style.display = "";
    if (artFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                artImg.src = ev.target.result;
                artImg.style.display = 'block';
                artImg.title = `${currentGroupName} ${titleDiv.innerText}`;
            }
        };
        reader.readAsDataURL(artFile);
    }
    else {
        artImg.style.display = "none";
        artImg.classList.add("fade");
        artImg.classList.remove("show");
        directoryDiv.style.display = "";
    }
    objLoader.setDriverForFile(group.media.get(mediaName), testMode)
        .catch((err) => {
        console.error(`Error reading file:`, err);
    });
};
//Navigate to search URL for selected program
webIcon.onclick = () => {
    if (mediaSelect.selectedIndex > -1) {
        const newWindow = window.open(`${PROGRAM_SEARCH_URL}Commodore ${currentGroupName} ${titleDiv.innerText}`, '_blank');
        if (newWindow) {
            newWindow.focus();
        }
    }
};
connectIcon.onclick = () => {
    if (objLoader) {
        objLoader.togglePortOpenClose(DEFAULT_BAUD_RATE);
    }
};
//Toggle display of directory listing on top of image art
artImg.onclick = () => {
    toggleDir();
};
directoryDiv.onclick = () => {
    toggleDir();
};
//Toggle show image or program directory
function toggleDir() {
    if (directoryDiv.style.display == "none") {
        artImg.classList.add("fade");
        artImg.classList.remove("show");
        directoryDiv.style.display = "";
    }
    else {
        directoryDiv.style.display = "none";
        artImg.classList.remove("fade");
        artImg.classList.add("show");
    }
}
//Invoke objLoader from class
function setup() {
    try {
        objLoader = new programLoader();
        objLoader.on("data", receiveData);
        objLoader.on("progress", updateProgressBar);
    }
    catch (err) {
        alert(err);
        return;
    }
    //Check for testMode on the end of the URL e.g. ~index.html?testMode=true
    const urlParams = new URLSearchParams(window.location.search);
    testMode = urlParams.get('testMode') ? true : false;
}
//Update the received message span with Serial data received
function receiveData(event) {
    const customEvent = event;
    switch (customEvent.detail.code) {
        case userEvent.EventCode.SERCON:
            connectIcon.src = "./resources/usb-connected.png";
            break;
        case userEvent.EventCode.SERDIS:
            connectIcon.src = "./resources/usb-disconnected.png";
            break;
        case userEvent.EventCode.ARDCON:
            connectIcon.src = "./resources/usb-handshake-ok.png";
            break;
    }
    if (customEvent.detail.code == userEvent.EventCode.DIRLIST) {
        directoryDiv.innerHTML = `<pre class="pre-fixed">${customEvent.detail.msg}</pre>`;
    }
    else {
        receivedMsgDiv.innerHTML = `<p>${customEvent.detail.code}</p>`;
    }
}
function updateProgressBar(event) {
    const customEvent = event;
    progressDiv.style.width = `${customEvent.detail.progress}%`;
}
//Run the setup function when the page is loaded
document.addEventListener("DOMContentLoaded", setup);
