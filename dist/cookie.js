"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Cookie {
    constructor(name) {
        this.cache = {};
        this.name = name;
        this.cookieCacheFile = path_1.default.resolve(process.cwd(), name + '.dat');
    }
    dump() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                fs_1.default.writeFile(this.cookieCacheFile, JSON.stringify(this.cache, null, 2), (err) => {
                    if (err) {
                        reject('Write cookie cache file error.');
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    restore() {
        return new Promise((resolve, reject) => {
            if (!fs_1.default.existsSync(this.cookieCacheFile)) {
                resolve();
                return;
            }
            fs_1.default.readFile(this.cookieCacheFile, (err, data) => {
                if (err) {
                    reject('Write cookie cache file error.');
                }
                this.cache = JSON.parse(data.toString());
                resolve();
            });
        });
    }
    add(key, value) {
        this.cache[key] = value;
    }
    remove(key) {
        delete this.cache[key];
    }
    parse(str, add = true) {
        const content = str.split(';')[0];
        const matches = content.match(/(.+)=(.+)/);
        if (!matches)
            return [];
        add && this.add(matches[1], matches[2]);
        return matches.slice(1);
    }
    serialize() {
        let str = '';
        Object.entries(this.cache).forEach(([key, value]) => {
            str += `${key}=${value}; `;
        });
        str = str && str.substr(0, str.length - 2);
        return str;
    }
    clear() {
        this.cache = {};
    }
}
exports.default = Cookie;
//# sourceMappingURL=cookie.js.map