namespace userEvent {
	// Event handler codes
	export const EventCode = {
		SERCON: "Serial device connected",
		SERDIS: "Serial device disconnected",
		SERERR: "Error opening serial port",
		DRVUNS: "No driver found for selected program",
		CHAUNS: "Unsupported channel",
		ARDWIP: "Connecting to Arduino",
		ARDCON: "Connected to Arduino",
		DIRLIST: "Directory listing"
	} as const;
}