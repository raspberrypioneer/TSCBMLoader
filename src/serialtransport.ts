interface ISerialTransport {
    connect(baud : number): Promise<void>;
    disconnect(): Promise<void>;
    isReadable(): boolean;
    write(data: Uint8Array): Promise<void>;
    protocolWrite(data: ArduinoMsg): Promise<void>;
    read(): Promise<Uint8Array>;
    cancelRead(): Promise<void>;
}

class WebSerialTransport implements ISerialTransport {
	private port!: SerialPort; // Serial port object
	private reader!: ReadableStreamBYOBReader; // Reader for the serial port
    private readbuf = new ArrayBuffer(arduino.BUFFER_SIZE);

    async connect(baud : number) {
        this.port = await navigator.serial.requestPort({ filters: SERIAL_DEVICE_FILTERS });  //Open pop-up selection window showing available ports
        await this.port.open({ baudRate: baud });
    }

    async disconnect() {
        await this.port?.close();
    }

    isReadable() {
        return this.port.readable ? true : false;
    }

    async write(data: Uint8Array) {
        const writer = this.port.writable!.getWriter();  //Initialize the writer
        await writer.write(data);  //Send data
        writer.releaseLock();  //Release the writer
    }

    async protocolWrite(data: ArduinoMsg) {
        const writer = this.port.writable!.getWriter();  //Initialize the writer
        await writer.write(data.protocol);  //Send protocol data
        await writer.write(data.payload);  //Send data
        writer.releaseLock();  //Release the writer
    }

    async read(): Promise<Uint8Array> {
        if (!this.reader) {
            this.reader = this.port.readable!.getReader({ mode: "byob" });  //Initialize reader, mode is bring-your-own-buffer
        }

        const { value, done } = await this.reader.read(new Uint8Array(this.readbuf));  //Read serial buffer
        if (value) {
            this.readbuf = value.buffer;  //Reset the buffer
        }
        if (done) {
            this.reader.releaseLock();
            throw new Error("Disconnected");
        }

        return value;
    }

    async cancelRead() {
        this.reader?.cancel();  //Stop the reader
    }

}

//TODO: Add Android when ready
class AndroidSerialTransport implements ISerialTransport {

    connect(baud: number): Promise<void> {
        throw new Error("Method not implemented.");
    }
    disconnect(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    isReadable(): boolean {
        throw new Error("Method not implemented.");
    }
    write(data: Uint8Array): Promise<void> {
        throw new Error("Method not implemented.");
    }
    protocolWrite(data: ArduinoMsg): Promise<void> {
        throw new Error("Method not implemented.");
    }
    read(): Promise<Uint8Array> {
        throw new Error("Method not implemented.");
    }
    cancelRead(): Promise<void> {
        throw new Error("Method not implemented.");
    }

};
