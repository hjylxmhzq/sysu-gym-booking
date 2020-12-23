"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const io = {
    updateLine(text) {
        readline_1.default.clearLine(process.stdout, 0);
        readline_1.default.cursorTo(process.stdout, 0);
        process.stdout.write(text);
    }
};
exports.default = io;
//# sourceMappingURL=io.js.map