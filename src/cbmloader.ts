/// <reference path="d64driver.ts" />
/// <reference path="prgdriver.ts" />
/// <reference path="t64driver.ts" />
/// <reference path="arduino.ts" />
/// <reference path="serialtransport.ts" />

// Settings: Amend pins and device filters below as required
const ATN_CLOCK_DATA_RESET_PINS = "9|18|19|20";  //Arduino Pro Micro
//const ATN_CLOCK_DATA_RESET_PINS = "2|3|4|5";  //Arduino Uno
const SERIAL_DEVICE_FILTERS = [
	{ usbVendorId: 0x2341, usbProductId: 0x8036 },   //Arduino Pro Micro
	{ usbVendorId: 0x2341, usbProductId: 0x0001 },   //Arduino Uno
	{ usbVendorId: 0x2341, usbProductId: 0x0043 }    //Arduino Uno (another)
];
// End of settings

// Arduino handshake messages
const HANDSHAKE_READY = "<CON>\r";
const HANDSHAKE_SEND = "<AOK>";
const HANDSHAKE_OK = "<END>\r";

// Drivers
const supportedDrivers = {"D64": d64driver, "PRG": prgdriver, "T64": t64driver};

type ArduinoMsg = { protocol: Uint8Array, payload: Uint8Array };

class programLoader {
	transport: any = null // ISerialTransport;
	isPortOpen: boolean = false;
	isHandshakeValid: boolean = false;
	serialReadPromise!: Promise<void>; // Promise for the serial read operation

	driver: any = null; // Driver for the selected program type
	programSize: number = 0; // Size of the program being loaded
	bytesReceived: number = 0; // Number of bytes received so far
	on!: (message: string, handler: EventListenerOrEventListenerObject) => void; // Event listener property

	constructor() {

		//Setup event listener if caller passes in a message and handler
		this.on = (message, handler) => {
			parent.addEventListener(message, handler);
		};

//TODO: Needed?
		//Setup serial connect, disconnect event handlers
//		navigator.serial.addEventListener("connect", this.serialConnect);
//		navigator.serial.addEventListener("disconnect", this.serialDisconnect);
	}

	#createTransport(): ISerialTransport {
		if ((window as any).AndroidSerial) {
			return new AndroidSerialTransport();
		}
		if (navigator.serial) {
			return new WebSerialTransport();
		}

		throw new Error("No serial device support available");
	}

	//Open or close serial port
	async togglePortOpenClose(baud : number) {

		if (this.isPortOpen) {
			if (this.isHandshakeValid)
				await this.transport.cancelRead();
			await this.serialReadPromise;  //Wait for the receiveArduino function to stop
			await this.transport.disconnect();
			this.isPortOpen = false
			this.isHandshakeValid = false
			this.transport = null;
			parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.SERDIS} }));
		}
		else {
			try {
				this.transport = this.#createTransport();
				await this.transport.connect(baud);
				this.serialReadPromise = this.receiveArduino().catch(err => {
					console.error("Error on serial port:", err);
				});
				this.isPortOpen = true
				parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.SERCON} }));

			} catch (err) {
				console.error("Error opening serial port:", err);
				parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.SERERR} }));
			}
		}

	}  //togglePortOpenClose

	//Assign program to load
	async setDriverForFile(file: File, testMode: boolean) {

		//Use the file extension to assign the driver class
		const extension = (file.name.split('.').pop() ?? "").toUpperCase();
		const driverClass = supportedDrivers[extension as keyof typeof supportedDrivers];
		if (driverClass != undefined) {
			this.driver = new driverClass(file);
			await this.driver.readBinaryFile();
			await this.driver.buildDirectory();
		}
		else {
			parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.DRVUNS} }));
		}

		//Update load progress
		parent.dispatchEvent(new CustomEvent('progress', { detail: {progress: "0%"} }));

		let AMsg: ArduinoMsg;

		//Return directory listing
		if (this.driver) {
			let htmlDirList = "";
			do {
				AMsg = await this.driver.getDirectoryLine();
				const fileBlocks = AMsg.payload[0] | AMsg.payload[1] << 8;
				htmlDirList += String(fileBlocks) + " " + (String.fromCharCode(...AMsg.payload.slice(2))).replace(String.fromCharCode(arduino.REVERSE_CHAR),"").replace(/[^A-Z0-9 !"#%&'()+-/@*[\]:;=<>,.?]/g, "-") + "<br/>";
				if (testMode) {
					console.log(AMsg.payload);
				}
				if (AMsg.protocol[0] != arduino.Command.DIR_NORMAL) {
					break;
				}
			} while (true);
			parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.DIRLIST, msg: htmlDirList} }));
		}

		//In test mode, return program data payloads
		if (testMode && this.driver) {

			const delay: (millis: number) => Promise<void> = (millis) => new Promise<void>((resolve, reject) => {
				setTimeout(() => resolve(), millis);
			});

			const messagebuf = [42];  //* wildcard character
			if (await this.driver.openProgram(messagebuf)) {
				this.programSize = this.driver.subProgSize;
				this.bytesReceived = 0;
				do {
					AMsg = await this.driver.getBuffer();

					this.bytesReceived += AMsg.protocol[1];
					var progress = Math.ceil((this.bytesReceived / this.programSize) * 100);
					parent.dispatchEvent(new CustomEvent('progress', { detail: { progress: progress } }));  //Update load progress
					console.log(`READ_CMD: Sent ${this.bytesReceived} of ${this.programSize} bytes`);

					if (testMode) {
						console.log(AMsg.payload);
					}
					await delay(10);

					if (AMsg.protocol[0] != arduino.Command.BUF_NORMAL) {
						break;
					}
				} while (true);
			}
		}

	}  //setDriverForFile

	//Receive data from Arduino and perform actions based on the protocol indicators
	async receiveArduino() {

		this.isHandshakeValid = false;
		let messagebuf = new Array();
		let msg = [];
		let channel = 0;
		let bufLen = 0;
		let ok = true;
		let AMsg: ArduinoMsg;

		while (this.transport.isReadable()) {

			try {
				const value = await this.transport.read();

				if (value) {
					messagebuf = messagebuf.concat(Array.from(value));  //append the reader data to the message buffer

					if (this.isHandshakeValid && this.driver) {

						//Process the instructions in the message buffer
						ok = true;
						while (messagebuf.length > 0 && ok) {

							//Check first byte for the action required
							switch (messagebuf[0]) {

								//Handle open command
								case arduino.Command.OPEN:
									ok = false;  //Assume the open message is incomplete
									if (messagebuf.length > 1) {
										bufLen = messagebuf[1];
										if (messagebuf.length >= bufLen) {
											ok = true;  //Open message is complete, continue
											channel = messagebuf[2];
											msg = messagebuf.splice(0,3);  //remove the command, message length, channel used above
											msg = messagebuf.splice(0, bufLen-3);  //next are the open command bytes

											if (msg.length > 0) {

												//Check the channel is supported (open to read)
												if ([0,2,8].includes(channel)) {
			
													//Return first payload, either a directory line or buffer load of program bytes
													if (msg[0] == 36) {  //$ directory character
														console.log("DIR_CMD: Start directory listing");
														await this.transport.write(Uint8Array.from([arduino.Command.DIR,0]));
													}
													else {
														console.log(`OPEN_CMD: Open file [${msg}]`);
														if (await this.driver.openProgram(msg)) {
															this.programSize = this.driver.subProgSize;
															this.bytesReceived = 0;
															AMsg = await this.driver.getBuffer();
															await this.transport.protocolWrite(AMsg);

															this.bytesReceived += AMsg.protocol[1];
															var progress = Math.ceil((this.bytesReceived / this.programSize) * 100);
															parent.dispatchEvent(new CustomEvent('progress', { detail: { progress: progress } }));  //Update load progress
															console.log(`READ_CMD: Sent ${this.bytesReceived} of ${this.programSize} bytes`);
														}
														else {
															console.log(`OPEN_FNF: Error opening ${msg}`);
															await this.transport.write(Uint8Array.from([arduino.Command.OPEN_FNF,1]));
															messagebuf = [];  //Clear the message buffer
														}
													}

												}
												else {
													const cmdName = String.fromCharCode(...msg);
													if (channel == 1 || (channel == 15 && cmdName.substring(0, 2) == "S:")) {
														console.log(`Pseudo-supported channel [${channel}] with command [${msg}]`);
														await this.transport.write(Uint8Array.from([arduino.Command.WRITE_FULL]));  //Acknowlege write instruction
													}
													else {
														if (cmdName == "M-R\xc4\xe5\x04" || cmdName == "M-R\xc6\xe5\x04") {
															//M-R for the drive number, see dos1541 rom $25c6 ($e5c4 - $c000 + 2)
															await this.transport.write(Uint8Array.from([arduino.Command.BUF_END,2,52,177]));  //Bytes from $25c6. Used in Bruce Lee 2
														}
														else {
															console.log(`Unsupported channel [${channel}] with command [${msg}]`);
															parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.CHAUNS} }));
															messagebuf = [];  //Clear the message buffer
														}
													}

												}
											}
											else {
												console.log(`Unsupported channel [${channel}] with command [${msg}]`);
												await this.transport.write(Uint8Array.from([arduino.Command.OPEN_FNF,1]));
												parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.CHAUNS} }));
												messagebuf = [];  //Clear the message buffer
											}
										}
									}
									break;

								//Handle read buffer command
								case arduino.Command.READ:
									msg = messagebuf.shift();  //remove the command

									//Return next payload
									AMsg = await this.driver.getBuffer();
									await this.transport.protocolWrite(AMsg);

									this.bytesReceived += AMsg.protocol[1];
									var progress = Math.ceil((this.bytesReceived / this.programSize) * 100);
									parent.dispatchEvent(new CustomEvent('progress', { detail: { progress: progress } }));  //Update load progress
									console.log(`READ_CMD: Sent ${this.bytesReceived} of ${this.programSize} bytes`);
									break;

								//Log close command
								case arduino.Command.CLOSE:
									msg = messagebuf.shift();  //remove the command
									console.log("CLOSE_CMD: Closed file");
									break;

								//Handle directory listing command
								case arduino.Command.DIR:
									msg = messagebuf.shift();  //remove the command

									//Return directory line
									await this.transport.protocolWrite(await this.driver.getDirectoryLine());
									break;

								case arduino.Command.WRITE_FULL:
								case arduino.Command.WRITE_PART:
									ok = false;  //Assume the write message is incomplete
									if (messagebuf.length > 1) {
										bufLen = messagebuf[1];
										if (messagebuf.length >= bufLen) {
											console.log(`WRITE_CMD: Received ${bufLen} bytes`);
											ok = true;  //Write message is complete, continue
											msg = messagebuf.splice(0, bufLen);  //ignore write/save data
										}
									}
									break;

								//Debug instruction ('D' with a CR means debug message to process)
								case arduino.Command.DEBUG:
									ok = false;  //Assume the debug message is incomplete
									let debugMsg = String.fromCharCode(...messagebuf);
									let cr_index = debugMsg.indexOf("\r\n");
									if (cr_index > 0) {
										ok = true;  //Debug message is complete, continue
										msg = messagebuf.splice(0, cr_index+2);  //remove the message including the CR/LF on the end
										console.log(`DEBUG_CMD: ${debugMsg.substring(0,cr_index)}`);
									}
									break;

								//Disgard any other messages
								default:
									msg = messagebuf.shift();  //remove the command
									console.log(`Disgarded message: ${msg}`);
								}
						}  //while

					}
					else {
						//Do the connection handshake
						let handshake = String.fromCharCode(...messagebuf);
						if (handshake.includes(HANDSHAKE_READY)) {
							console.log("Connecting to Arduino");
							parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.ARDWIP} }));

							await this.transport.write(new TextEncoder().encode(HANDSHAKE_SEND + "0|8|" + ATN_CLOCK_DATA_RESET_PINS + "\r"));
							messagebuf = [];  //Clear the message buffer, ready for next stage
						}
						else if (handshake.includes(HANDSHAKE_OK)) {
							console.log("Connected to Arduino");
							parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.ARDCON} }));

							this.isHandshakeValid = true;
							messagebuf = [];  //Clear the message buffer, ready for next stage
						}
					}

				}
			} catch (err) {
				console.log("DONE!");
				break;
			}

		}  //while

	}  //receiveArduino

//TODO: Needed?
	//Event handler for each time a new serial device connects
//	serialConnect(event: Event): void {
//		console.log((event.target as SerialPort));
//	}

	//Event handler for each time a new serial device disconnects
//	serialDisconnect(event: Event): void {
//		console.log((event.target as SerialPort));
//		parent.dispatchEvent(new CustomEvent('data', { detail: {code: userEvent.EventCode.SERDIS} }));
//	}

}