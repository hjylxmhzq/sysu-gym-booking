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
exports.EasyDate = exports.getUserInfo = exports.solveCaptcha = exports.secondsFormat = void 0;
const form_data_1 = __importDefault(require("form-data"));
const axios_1 = __importDefault(require("axios"));
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
const USER_INFO_FILE = './user-info.json';
function secondsFormat(s) {
    const day = Math.floor(s / (24 * 3600)); // Math.floor()向下取整 
    const hour = Math.floor((s - day * 24 * 3600) / 3600);
    const minute = Math.floor((s - day * 24 * 3600 - hour * 3600) / 60);
    const second = (s - day * 24 * 3600 - hour * 3600 - minute * 60) >> 0;
    return day + "天" + hour + "时" + minute + "分" + second + "秒";
}
exports.secondsFormat = secondsFormat;
function solveCaptcha(img) {
    return __awaiter(this, void 0, void 0, function* () {
        const fd = new form_data_1.default();
        fd.append('img', img, { filename: 'captcha.jpg' });
        const res = yield axios_1.default.post('http://tony-space.top:8989/captcha', fd.getBuffer(), {
            headers: {
                'Content-Type': fd.getHeaders()['content-type'],
                "Content-Length": fd.getLengthSync(),
            }
        });
        return res.data;
    });
}
exports.solveCaptcha = solveCaptcha;
function getUserInfo(showLog = true) {
    return __awaiter(this, void 0, void 0, function* () {
        if (fs_1.default.existsSync(USER_INFO_FILE)) {
            showLog && console.log('账号已保存，请妥善保管当前目录下的user-info.json，如果您想切换账号，请删除此文件');
            return JSON.parse(fs_1.default.readFileSync(USER_INFO_FILE).toString());
        }
        const answers = yield inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'NetId: '
            },
            {
                type: 'password',
                name: 'password',
                message: '密码: '
            }
        ]);
        fs_1.default.writeFileSync(USER_INFO_FILE, JSON.stringify(answers, null, 2));
        return answers;
    });
}
exports.getUserInfo = getUserInfo;
class EasyDate extends Date {
    constructor() {
        super();
    }
    addDay(days) {
        this.setTime(this.getTime() + 3600 * 1000 * 24 * days);
    }
    getDateStr() {
        return '' + this.getFullYear() + '-' + (this.getMonth() + 1) + '-' + this.getDate();
    }
}
exports.EasyDate = EasyDate;
//# sourceMappingURL=utils.js.map