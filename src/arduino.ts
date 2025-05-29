namespace arduino {

	export const enum Command {

		//Commands received
		OPEN = 79,  //'O'
		READ = 82,  //'R'
		CLOSE = 67,  //'C'
		DIR = 76,  //'L'
		WRITE_FULL = 87, //'W'
		WRITE_PART = 119, //'w'
		DEBUG = 68,  //'D'

		//Commands sent
		OPEN_FNF = 88,  //'X'
		BUF_NORMAL = 66,  //'B'
		BUF_END = 98,  //'b'
		DIR_NORMAL = 76,  //'L'
		DIR_END = 108  //'l'
	}

	export const BUFFER_SIZE = 256;
	export const MAX_BYTES_PER_REQUEST = 254;

	export const REVERSE_CHAR = 18;  //Commodore reverse text colour code
	export const SPACE_CHAR = 32;  //' '
	export const QUOTE_CHAR = 34;  //'"'
	export const NON_SPACE_CHAR = 160;  //' '

	export const FILE_TYPES = [[68, 69, 76],[83, 69, 81],[80, 82, 71],[85, 83, 82],[82, 69, 76]];  //"DEL", "SEQ", "PRG", "USR", "REL"

}