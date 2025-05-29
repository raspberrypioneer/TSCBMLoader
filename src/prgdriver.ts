class prgdriver {
    fileRef: File;  //File reference
    progName: string;  //Program name
    progSize: number;  //Program size
    subProgSize: number;  //Sub-program size
    progPos: number;  //Program position
    blockSize: number;  //Block size
    progBytes: Uint8Array;  //Program byte array

	constructor(file: File) {

        this.fileRef = file;
        this.progName = file.name;
        this.progSize = file.size;
        this.subProgSize = file.size;
        this.progPos = 0;
        this.blockSize = Math.ceil(file.size/256);
        this.progBytes = new Uint8Array(0);

    }

    //Read binary file into byte array
	async readBinaryFile() {

		const buffer = await this.fileRef.arrayBuffer();  //Read file contents into array buffer
		this.progBytes = new Uint8Array(buffer);  //Get byte array for the array buffer

    }  //readBinaryFile

    //Return buffer load of data from current program position
    async getBuffer() {

        const currentPos = this.progPos;
        const packetSize = Math.min((this.progSize - currentPos), arduino.MAX_BYTES_PER_REQUEST);
        this.progPos += packetSize;
        return {protocol: Uint8Array.from([(packetSize == arduino.MAX_BYTES_PER_REQUEST ? arduino.Command.BUF_NORMAL : arduino.Command.BUF_END), packetSize]), payload: this.progBytes.slice(currentPos, currentPos + packetSize)};

    }  //getBuffer

    //Create a directory list
    async buildDirectory() {
        //Nothing needed for PRG files
        //Included here for consistency with other drivers
    }

    //Return directory line
    async getDirectoryLine() {

        const blockHigh = (this.blockSize >> 8) & 0xFF;
        const blockLow = this.blockSize & 0xFF;
        return {protocol: Uint8Array.from([arduino.Command.DIR_END, this.progName.length+2]), payload: Uint8Array.from([blockLow,blockHigh].concat(Array.from(new TextEncoder().encode(this.progName.toUpperCase()))))};

    }  //getDirectoryLine
    
    //Open program, just position reset is required
    async openProgram(bytesProgName: string) {

        this.progPos = 0;
        return true;

    }  //openProgram

}