"use strict";
var arduino;
(function (arduino) {
    arduino.BUFFER_SIZE = 256;
    arduino.MAX_BYTES_PER_REQUEST = 254;
    arduino.REVERSE_CHAR = 18; //Commodore reverse text colour code
    arduino.SPACE_CHAR = 32; //' '
    arduino.QUOTE_CHAR = 34; //'"'
    arduino.NON_SPACE_CHAR = 160; //' '
    arduino.FILE_TYPES = [[68, 69, 76], [83, 69, 81], [80, 82, 71], [85, 83, 82], [82, 69, 76]]; //"DEL", "SEQ", "PRG", "USR", "REL"
})(arduino || (arduino = {}));
