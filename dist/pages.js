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
exports.GymPage = exports.CasPage = exports.Page = void 0;
const cheerio_1 = __importDefault(require("cheerio"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const form_data_1 = __importDefault(require("form-data"));
const axios_1 = __importDefault(require("axios"));
const cookie_1 = __importDefault(require("./cookie"));
const io_1 = __importDefault(require("./io"));
const utils_1 = require("./utils");
class Page {
    constructor(cookieFileName) {
        this.cookie = new cookie_1.default(cookieFileName);
        this.defaultHeaders = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        };
    }
    get(url, headers = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                },
                headers: Object.assign(Object.assign({ Cookie: this.cookie.serialize() }, this.defaultHeaders), headers)
            };
            return axios_1.default.get(url, options).catch(err => {
                return err;
            });
        });
    }
    postFormData(url, data, headers = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const fd = new form_data_1.default();
            Object.entries(data).forEach(([key, value]) => {
                fd.append(key, value ? String(value) : '');
            });
            return axios_1.default({
                method: 'post',
                url,
                data: fd.getBuffer(),
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                },
                headers: Object.assign(Object.assign({ 'Content-Type': fd.getHeaders()['content-type'], "Content-Length": fd.getLengthSync(), Cookie: this.cookie.serialize() }, this.defaultHeaders), headers),
            }).catch(err => {
                return err;
            });
        });
    }
    parseHtml(html) {
        const $ = cheerio_1.default.load(html);
        return $;
    }
    openLocalFile(fileOrUrl) {
        let cmd = '';
        if (fileOrUrl.startsWith('http')) {
            if (process.platform == 'win32') {
                cmd = 'start "%ProgramFiles%\Internet Explorer\iexplore.exe" ';
            }
            else {
                cmd = 'start ';
            }
        }
        if (process.platform == 'linux') {
            cmd = 'xdg-open ';
        }
        else if (process.platform == 'darwin') {
            cmd = 'open ';
        }
        child_process_1.exec(`${cmd}"${fileOrUrl}"`);
    }
}
exports.Page = Page;
class CasPage extends Page {
    constructor() {
        super('caspage_cookie');
        this.refUrl = '';
        this.userInfo = {
            username: '',
            password: '',
        };
        this.form = {
            username: '',
            password: '',
            captcha: '',
            execution: '',
            _eventId: 'submit',
            submit: 'LOGIN',
            geolocation: ''
        };
    }
    init(refUrl = 'http://gym.sysu.edu.cn/login/pre.html') {
        return __awaiter(this, void 0, void 0, function* () {
            // await this.cookie.restore();
            const res = yield this.get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, { Host: 'cas.sysu.edu.cn' });
            if (res.response && res.response.status === 302) {
                return res.response.headers['location'];
            }
            this.refUrl = refUrl;
            const $ = yield this.getLoginPage(refUrl);
            this.form.execution = $('#fm1 input[name="execution"]')[0].attribs.value;
        });
    }
    setUserInfo(username, password) {
        this.userInfo.username = username;
        this.userInfo.password = password;
    }
    login(retry = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.refUrl)
                throw new Error('method init() should be called before login()');
            const captchaBuf = yield this.getCaptcha();
            const captcha = yield utils_1.solveCaptcha(captchaBuf);
            this.form.username = this.userInfo.username;
            this.form.password = this.userInfo.password;
            this.form.captcha = captcha;
            const res = yield this.postFormData(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, this.form, { Host: 'cas.sysu.edu.cn' });
            if (!res || res.status !== 302) {
                if (retry > 10) {
                    throw new Error('Login error, please check your netid and password');
                }
                else {
                    return this.login(retry + 1);
                }
            }
            else {
                try {
                    res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie) => {
                        this.cookie.parse(cookie);
                    }));
                    // await this.cookie.dump();
                    return res.headers['location'];
                }
                catch (e) {
                    throw e;
                }
            }
        });
    }
    getCaptcha(show = false) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolveOut, rejectOut) => {
                axios_1.default.get('https://cas.sysu.edu.cn/cas/captcha.jsp', { headers: { Cookie: this.cookie.serialize() }, responseType: 'arraybuffer' }).then((res) => __awaiter(this, void 0, void 0, function* () {
                    const data = res.data;
                    const tmpFilePath = path_1.default.resolve(os_1.default.tmpdir(), 'temp_captcha.jpg');
                    yield new Promise((resolve, reject) => {
                        fs_1.default.writeFile(tmpFilePath, data, err => {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve();
                            }
                        });
                    });
                    show && this.openLocalFile(tmpFilePath);
                    resolveOut(data);
                }));
            });
        });
    }
    getLoginPage(refUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return axios_1.default.get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(refUrl)}`, { headers: Object.assign({ Host: 'cas.sysu.edu.cn' }, this.defaultHeaders) }).then(res => {
                const headers = res.headers;
                this.cookie.parse(headers['set-cookie'][0]);
                const $ = this.parseHtml(res.data);
                return $;
            });
        });
    }
}
exports.CasPage = CasPage;
class GymPage extends Page {
    constructor(serviceId = '61') {
        super('gympage_cookie');
        this.keepAliveTimer = null;
        this.date = '';
        this.time = '';
        this.serviceId = serviceId;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            // await this.cookie.restore();
            const res = yield this.get('http://gym.sysu.edu.cn/index.html');
            const $ = this.parseHtml(res.data);
            const usernameEl = $('#onlinename');
            return !!usernameEl.length;
        });
    }
    login(urlWithTicket) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.get(urlWithTicket);
            res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie) => {
                this.cookie.parse(cookie);
            }));
            // await this.cookie.dump();
        });
    }
    keepAlive(during = 600 /* seconds */) {
        const loop = () => __awaiter(this, void 0, void 0, function* () {
            const res = yield this.get('http://gym.sysu.edu.cn/index.html');
            io_1.default.updateLine(`Heartbeat request is sent [${new Date().toLocaleString()}]`);
            res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie) => {
                this.cookie.parse(cookie);
                // this.cookie.dump();
            }));
            const isLogin = yield this.init();
            if (!isLogin) {
                console.log('已退出登陆');
                return;
            }
            this.keepAliveTimer = setTimeout(() => {
                loop();
            }, during * 1000);
        });
        loop();
    }
    destroy() {
        this.keepAliveTimer && clearTimeout(this.keepAliveTimer);
    }
    setServiceId(id = '30') {
        this.serviceId = id;
    }
    setDate(date) {
        this.date = date;
    }
    getTimeList() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new utils_1.EasyDate();
            if (this.date !== now.getDateStr()) { // 当预定非当天的球场时，获取下一天的时间表，以免获取不到完整时间表
                now.addDay(1);
            }
            const res = yield this.get(`http://gym.sysu.edu.cn/product/getarea2.html?s_dates=${now.getDateStr()}&serviceid=${this.serviceId}&type=day`);
            return res.data.timeList.map((item) => item.TIME_NO);
        });
    }
    getServices() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.get(`http://gym.sysu.edu.cn/product/index.html`);
            const $ = this.parseHtml(res.data);
            const items = $('.item-ul li');
            const services = [];
            const lnks = items.find('a');
            const names = items.find('dl > dd > h5');
            for (let i = 0; i < items.length; i++) {
                const link = lnks[i].attribs.href || '';
                const matchId = link.match(/\?id=(\d+)/);
                const name = names[i].children[0].data;
                if (matchId && name) {
                    services.push([matchId[1], name]);
                }
            }
            return services;
        });
    }
    setTime(time) {
        this.time = time;
    }
    getOkArea() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.get(`http://gym.sysu.edu.cn/product/findOkArea.html?s_date=${this.date}&serviceid=${this.serviceId}`);
            const areas = res.data.object && res.data.object.filter((area) => area.stock.time_no === this.time && area.status === 1); // status === 1 表示场地可预定
            return areas || [];
        });
    }
    book(area) {
        return __awaiter(this, void 0, void 0, function* () {
            const param = `{"activityPrice":0,"activityStr":null,"address":null,"dates":null,"extend":null,"flag":"0","isBulkBooking":null,"isbookall":"0","isfreeman":"0","istimes":"1","mercacc":null,"merccode":null,"order":null,"orderfrom":null,"remark":null,"serviceid":null,"shoppingcart":"0","sno":null,"stock":{"${area.stockid}":"1"},"stockdetail":{"${area.stockid}":"${area.id}"},"stockdetailids":"928163","stockid":null,"subscriber":"0","time_detailnames":null,"userBean":null}`;
            let orderid = yield this.searchInCart(area);
            if (orderid) {
                return orderid;
            }
            else {
                const res = yield this.postFormData('http://gym.sysu.edu.cn/order/book.html', { param, json: true });
                return res.data.object ? res.data.object.orderid : null;
            }
        });
    }
    pay(orderid) {
        return __awaiter(this, void 0, void 0, function* () {
            const param = `{"payid":2,"orderid":"${orderid}","ctypeindex":0}`; // payid = 2 表示使用运动经费支付
            const res = yield this.postFormData('http://gym.sysu.edu.cn/pay/account/topay.html', { param, json: true });
            return res.data;
        });
    }
    searchInCart(area) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.postFormData('http://gym.sysu.edu.cn/order/seachData.html', { orderid: '', id: '', page: '1', rows: '50' });
            if ((_a = res.data.rows) === null || _a === void 0 ? void 0 : _a.length) {
                const data = res.data.rows.filter((item) => {
                    return item.stockid === area.stockid && item.stockdetailid === area.id && item.status === 0; // status === 0 为预定中状态
                });
                if (data.length) {
                    return data[0].orderid;
                }
            }
            else {
                return null;
            }
        });
    }
}
exports.GymPage = GymPage;
//# sourceMappingURL=pages.js.map