"use strict";
/// <reference path="./cbmloader.ts" />
/// <reference path="./events.ts" />
const DEFAULT_BAUD_RATE = 115200;
const DEFAULT_RETRO = "c64"; //Used for logo and artwork images
const ALTERNATE_RETRO = "vic20"; //Used for logo and artwork images
const PROGRAM_SEARCH_URL = "https://www.google.com/search?q="; //Used on image artwork click
// Help text for each platform
let info_c64 = {};
let info_vic20 = {};
// HTML elements used in event handlers
let imgConnect;
let divReceivedMsg;
let divDirectory;
let divProgress;
//Setup the main elements and invoke objLoader from class
function setup() {
    if (!navigator.serial) {
        alert("WebSerial is not enabled in this browser");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('testMode') ? true : false;
    //Set default retro from local storage value
    let selectedRetro = localStorage.getItem("selectedRetro") || DEFAULT_RETRO;
    const objLoader = new jsCBMLoader(DEFAULT_BAUD_RATE);
    if (objLoader) {
        objLoader.on("data", receiveData);
        objLoader.on("progress", updateProgressBar);
    }
    imgConnect = document.getElementById('imgConnect');
    divReceivedMsg = document.getElementById('divReceivedMsg');
    divDirectory = document.getElementById('divDirectory');
    divProgress = document.getElementById('divProgress');
    const selProgList = document.getElementById('selProgList');
    const imgArt = document.getElementById('imgArt');
    const divProgressBar = document.getElementById('divProgressBar');
    const divTitle = document.getElementById('divTitle');
    const divInfo = document.getElementById('divInfo');
    const imgFileSelect = document.getElementById('imgFileSelect');
    const imgLogo = document.getElementById('imgLogo');
    const imgWeb = document.getElementById('imgWeb');
    const fileInput = document.getElementById('fileInput');
    imgConnect.onclick = function () {
        if (objLoader) {
            if (objLoader.port) {
                objLoader.closePort();
            }
            else {
                objLoader.openPort();
            }
        }
    };
    imgFileSelect.onclick = function () {
        fileInput.click();
    };
    fileInput.oninput = function () {
        selProgList.length = 0; //Clear the program selection list
        imgFileSelect.src = "./resources/files-empty.png";
        imgArt.style.display = "none";
        imgArt.classList.remove("fade");
        imgArt.classList.add("show");
        divReceivedMsg.innerHTML = "";
        divDirectory.style.display = "none";
        divDirectory.innerHTML = "";
        divProgressBar.style.display = "none";
        divTitle.innerText = "";
        divInfo.innerHTML = "";
        //Populate program selection list
        if (fileInput.files) {
            for (let i = 0; i < fileInput.files.length; i++) {
                selProgList.add(new Option(fileInput.files[i].name));
            }
        }
        else {
            return;
        }
        //Change icon to indicated selected
        if (selProgList.length > 0) {
            imgFileSelect.src = "./resources/files-available.png";
        }
        else {
            imgFileSelect.src = "./resources/files-empty.png";
        }
        //Only one item in the list, select it
        if (selProgList.length == 1) {
            if (objLoader) {
                objLoader.setDriverForFile(fileInput.files[0], testMode)
                    .catch((err) => {
                    console.error(`Error reading file:`, err);
                });
            }
            selProgList.selectedIndex = 0;
            setImageArt(selectedRetro);
        }
    };
    selProgList.onchange = function () {
        if (objLoader && fileInput.files) {
            objLoader.setDriverForFile(fileInput.files[selProgList.selectedIndex], testMode)
                .catch((err) => {
                console.error(`Error reading file:`, err);
            });
            setImageArt(selectedRetro);
        }
    };
    //Assign the default logo and allow it to be changed
    imgLogo.src = `./resources/logo_${selectedRetro}.png`;
    imgLogo.onclick = function () {
        selectedRetro = (selectedRetro == DEFAULT_RETRO ? ALTERNATE_RETRO : DEFAULT_RETRO);
        localStorage.setItem("selectedRetro", selectedRetro);
        imgLogo.src = `./resources/logo_${selectedRetro}.png`;
    };
    //Set the image art display attributes when found / not found
    imgArt.onerror = function () {
        this.style.display = "none";
        imgArt.classList.add("fade");
        imgArt.classList.remove("show");
        divDirectory.style.display = "";
    };
    imgArt.onload = function () {
        imgArt.style.display = "";
        imgArt.title = selProgList.value.split(".")[0];
    };
    //Toggle display of directory listing on top of image art
    imgArt.onclick = function () {
        toggleDir();
    };
    divDirectory.onclick = function () {
        toggleDir();
    };
    //Navigate to search URL for selected program
    imgWeb.onclick = function () {
        if (selProgList.selectedIndex > -1) {
            const newWindow = window.open(`${PROGRAM_SEARCH_URL}Commodore ${selectedRetro} ${imgArt.alt}`, '_blank');
            if (newWindow) {
                newWindow.focus();
            }
        }
    };
    //Set image art for selected program file
    function setImageArt(selectedRetro) {
        const itemName = selProgList.value.split(".")[0];
        imgArt.src = `./resources/art/${selectedRetro}/${itemName}-image.jpg`;
        imgArt.alt = itemName;
        divProgressBar.style.display = "";
        divProgress.style.width = "0%";
        divTitle.innerText = itemName;
        const info = selectedRetro == DEFAULT_RETRO ? info_c64 : info_vic20;
        divInfo.innerHTML = `<p>${info[selProgList.value] || ""}</p>`;
    }
    //Toggle show image or program directory
    function toggleDir() {
        if (divDirectory.style.display == "none") {
            imgArt.classList.add("fade");
            imgArt.classList.remove("show");
            divDirectory.style.display = "";
        }
        else {
            divDirectory.style.display = "none";
            imgArt.classList.remove("fade");
            imgArt.classList.add("show");
        }
    }
}
//Update the received message span with Serial data received
function receiveData(event) {
    const customEvent = event;
    switch (customEvent.detail.code) {
        case userEvent.EventCode.SERCON:
            imgConnect.src = "./resources/usb-connected.png";
            break;
        case userEvent.EventCode.SERDIS:
            imgConnect.src = "./resources/usb-disconnected.png";
            break;
        case userEvent.EventCode.ARDCON:
            imgConnect.src = "./resources/usb-handshake-ok.png";
            break;
    }
    if (customEvent.detail.code == userEvent.EventCode.DIRLIST) {
        divDirectory.innerHTML = `<pre class="pre-fixed-class">${customEvent.detail.msg}</pre>`;
    }
    else {
        divReceivedMsg.innerHTML = `<p>${customEvent.detail.code}</p>`;
    }
}
function updateProgressBar(event) {
    const customEvent = event;
    divProgress.style.width = `${customEvent.detail.progress}%`;
}
//Run the setup function when the page is loaded
document.addEventListener("DOMContentLoaded", setup);
