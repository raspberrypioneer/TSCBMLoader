"use strict";
class WebSerialTransport {
    port; // Serial port object
    reader; // Reader for the serial port
    readbuf = new ArrayBuffer(arduino.BUFFER_SIZE);
    async connect(baud) {
        this.port = await navigator.serial.requestPort({ filters: SERIAL_DEVICE_FILTERS }); //Open pop-up selection window showing available ports
        await this.port.open({ baudRate: baud });
    }
    async disconnect() {
        await this.port?.close();
    }
    isReadable() {
        return this.port.readable ? true : false;
    }
    async write(data) {
        const writer = this.port.writable.getWriter(); //Initialize the writer
        await writer.write(data); //Send data
        writer.releaseLock(); //Release the writer
    }
    async protocolWrite(data) {
        const writer = this.port.writable.getWriter(); //Initialize the writer
        await writer.write(data.protocol); //Send protocol data
        await writer.write(data.payload); //Send data
        writer.releaseLock(); //Release the writer
    }
    async read() {
        if (!this.reader) {
            this.reader = this.port.readable.getReader({ mode: "byob" }); //Initialize reader, mode is bring-your-own-buffer
        }
        const { value, done } = await this.reader.read(new Uint8Array(this.readbuf)); //Read serial buffer
        if (value) {
            this.readbuf = value.buffer; //Reset the buffer
        }
        if (done) {
            this.reader.releaseLock();
            throw new Error("Disconnected");
        }
        return value;
    }
    async cancelRead() {
        this.reader?.cancel(); //Stop the reader
    }
}
//TODO: Add Android when ready
class AndroidSerialTransport {
    connect(baud) {
        throw new Error("Method not implemented.");
    }
    disconnect() {
        throw new Error("Method not implemented.");
    }
    isReadable() {
        throw new Error("Method not implemented.");
    }
    write(data) {
        throw new Error("Method not implemented.");
    }
    protocolWrite(data) {
        throw new Error("Method not implemented.");
    }
    read() {
        throw new Error("Method not implemented.");
    }
    cancelRead() {
        throw new Error("Method not implemented.");
    }
}
;
