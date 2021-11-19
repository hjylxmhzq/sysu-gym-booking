'use strict';

var inquirer = require('inquirer');
var datepicker = require('inquirer-datepicker-prompt');
var readline = require('readline');
var cheerio = require('cheerio');
var fs = require('fs');
var os = require('os');
var path = require('path');
var child_process = require('child_process');
var FormData = require('form-data');
var axios = require('axios');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var inquirer__default = /*#__PURE__*/_interopDefaultLegacy(inquirer);
var datepicker__default = /*#__PURE__*/_interopDefaultLegacy(datepicker);
var readline__default = /*#__PURE__*/_interopDefaultLegacy(readline);
var cheerio__default = /*#__PURE__*/_interopDefaultLegacy(cheerio);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var os__default = /*#__PURE__*/_interopDefaultLegacy(os);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var FormData__default = /*#__PURE__*/_interopDefaultLegacy(FormData);
var axios__default = /*#__PURE__*/_interopDefaultLegacy(axios);

const io = {
    updateLine(text) {
        readline__default["default"].clearLine(process.stdout, 0);
        readline__default["default"].cursorTo(process.stdout, 0);
        process.stdout.write(text);
    }
};

class Cookie {
    cache;
    name;
    cookieCacheFile;
    constructor(name) {
        this.cache = {};
        this.name = name;
        this.cookieCacheFile = path__default["default"].resolve(process.cwd(), name + '.dat');
    }
    async dump() {
        return new Promise((resolve, reject) => {
            fs__default["default"].writeFile(this.cookieCacheFile, JSON.stringify(this.cache, null, 2), (err) => {
                if (err) {
                    reject('Write cookie cache file error.');
                }
                else {
                    resolve();
                }
            });
        });
    }
    restore() {
        return new Promise((resolve, reject) => {
            if (!fs__default["default"].existsSync(this.cookieCacheFile)) {
                resolve();
                return;
            }
            fs__default["default"].readFile(this.cookieCacheFile, (err, data) => {
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

const USER_INFO_FILE = './user-info.json';
function secondsFormat(s) {
    const day = Math.floor(s / (24 * 3600)); // Math.floor()向下取整 
    const hour = Math.floor((s - day * 24 * 3600) / 3600);
    const minute = Math.floor((s - day * 24 * 3600 - hour * 3600) / 60);
    const second = (s - day * 24 * 3600 - hour * 3600 - minute * 60) >> 0;
    return day + "天" + hour + "时" + minute + "分" + second + "秒";
}
async function solveCaptcha(img) {
    const fd = new FormData__default["default"]();
    fd.append('img', img, { filename: 'captcha.jpg' });
    const res = await axios__default["default"].post('http://tony-space.top:8989/captcha', fd.getBuffer(), {
        headers: {
            'Content-Type': fd.getHeaders()['content-type'],
            "Content-Length": fd.getLengthSync(),
        }
    });
    return res.data;
}
async function getUserInfo(showLog = true) {
    if (fs__default["default"].existsSync(USER_INFO_FILE)) {
        showLog && console.log('账号已保存，请妥善保管当前目录下的user-info.json，如果您想切换账号，请删除此文件');
        return JSON.parse(fs__default["default"].readFileSync(USER_INFO_FILE).toString());
    }
    const answers = await inquirer__default["default"].prompt([
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
    fs__default["default"].writeFileSync(USER_INFO_FILE, JSON.stringify(answers, null, 2));
    return answers;
}
class EasyDate extends Date {
    constructor() {
        super();
    }
    addDay(days) {
        this.setTime(this.getTime() + 3600 * 1000 * 24 * days);
    }
    getDateStr() {
        const day = ('0' + this.getDate()).substr(-2);
        const month = ('0' + (this.getMonth() + 1)).substr(-2);
        return '' + this.getFullYear() + '-' + month + '-' + day;
    }
}

class Page {
    cookie;
    defaultHeaders;
    constructor(cookieFileName) {
        this.cookie = new Cookie(cookieFileName);
        this.defaultHeaders = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        };
    }
    async get(url, headers = {}) {
        const options = {
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            headers: {
                Cookie: this.cookie.serialize(),
                ...this.defaultHeaders,
                ...headers
            }
        };
        return axios__default["default"].get(url, options).catch(err => {
            return err;
        });
    }
    async postFormData(url, data, headers = {}) {
        const fd = new FormData__default["default"]();
        Object.entries(data).forEach(([key, value]) => {
            fd.append(key, value ? String(value) : '');
        });
        return axios__default["default"]({
            method: 'post',
            url,
            data: fd.getBuffer(),
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            headers: {
                'Content-Type': fd.getHeaders()['content-type'],
                "Content-Length": fd.getLengthSync(),
                Cookie: this.cookie.serialize(),
                ...this.defaultHeaders,
                ...headers
            },
        }).catch(err => {
            return err;
        });
    }
    parseHtml(html) {
        const $ = cheerio__default["default"].load(html);
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
        child_process.exec(`${cmd}"${fileOrUrl}"`);
    }
}
class CasPage extends Page {
    refUrl;
    form;
    userInfo;
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
    async init(refUrl = 'http://gym.sysu.edu.cn/login/pre.html') {
        // await this.cookie.restore();
        const res = await this.get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, { Host: 'cas.sysu.edu.cn' });
        if (res.response && res.response.status === 302) {
            return res.response.headers['location'];
        }
        this.refUrl = refUrl;
        const $ = await this.getLoginPage(refUrl);
        this.form.execution = $('#fm1 input[name="execution"]')[0].attribs.value;
    }
    setUserInfo(username, password) {
        this.userInfo.username = username;
        this.userInfo.password = password;
    }
    async login(retry = 1) {
        if (!this.refUrl)
            throw new Error('method init() should be called before login()');
        const captchaBuf = await this.getCaptcha();
        const captcha = await solveCaptcha(captchaBuf);
        this.form.username = this.userInfo.username;
        this.form.password = this.userInfo.password;
        this.form.captcha = captcha;
        const res = await this.postFormData(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, this.form, { Host: 'cas.sysu.edu.cn' });
        if (!res || res.status !== 302 || !res.headers.location.includes('://gym')) {
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
    }
    async getCaptcha(show = false) {
        return new Promise((resolveOut, rejectOut) => {
            axios__default["default"].get('https://cas.sysu.edu.cn/cas/captcha.jsp', { headers: { Cookie: this.cookie.serialize() }, responseType: 'arraybuffer' }).then(async (res) => {
                const data = res.data;
                const tmpFilePath = path__default["default"].resolve(os__default["default"].tmpdir(), 'temp_captcha.jpg');
                await new Promise((resolve, reject) => {
                    fs__default["default"].writeFile(tmpFilePath, data, err => {
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
            });
        });
    }
    async getLoginPage(refUrl) {
        return axios__default["default"].get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(refUrl)}`, { headers: { Host: 'cas.sysu.edu.cn', ...this.defaultHeaders } }).then(res => {
            const headers = res.headers;
            this.cookie.parse(headers['set-cookie'][0]);
            const $ = this.parseHtml(res.data);
            return $;
        });
    }
}
class GymPage extends Page {
    keepAliveTimer = null;
    serviceId;
    date = '';
    time = '';
    constructor(serviceId = '61') {
        super('gympage_cookie');
        this.serviceId = serviceId;
    }
    async init() {
        // await this.cookie.restore();
        const res = await this.get('https://gym.sysu.edu.cn/index.html');
        const $ = this.parseHtml(res.data);
        const usernameEl = $('#onlinename');
        return !!usernameEl.length;
    }
    async login(urlWithTicket) {
        const url = new URL(urlWithTicket);
        url.protocol = 'https:';
        const res = await this.get(url.href);
        res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie) => {
            this.cookie.parse(cookie);
        }));
        // await this.cookie.dump();
    }
    keepAlive(during = 600 /* seconds */) {
        const loop = async () => {
            const res = await this.get('https://gym.sysu.edu.cn/index.html');
            io.updateLine(`Heartbeat request is sent [${new Date().toLocaleString()}]`);
            res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie) => {
                this.cookie.parse(cookie);
                // this.cookie.dump();
            }));
            const isLogin = await this.init();
            if (!isLogin) {
                console.log('已退出登陆');
                return;
            }
            this.keepAliveTimer = setTimeout(() => {
                loop();
            }, during * 1000);
        };
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
    async getTimeList() {
        const now = new EasyDate();
        if (this.date !== now.getDateStr()) { // 当预定非当天的球场时，获取下一天的时间表，以免获取不到完整时间表
            now.addDay(1);
        }
        const res = await this.get(`https://gym.sysu.edu.cn/product/getarea2.html?s_dates=${now.getDateStr()}&serviceid=${this.serviceId}&type=day`);
        return res.data.timeList.map((item) => item.TIME_NO);
    }
    async getServices() {
        const res = await this.get(`https://gym.sysu.edu.cn/product/index.html`);
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
    }
    setTime(time) {
        this.time = time;
    }
    async getOkArea() {
        const res = await this.get(`https://gym.sysu.edu.cn/product/findOkArea.html?s_date=${this.date}&serviceid=${this.serviceId}`);
        const areas = res.data.object && res.data.object.filter((area) => area.stock.time_no === this.time && area.status === 1); // status === 1 表示场地可预定
        return areas || [];
    }
    async book(area) {
        const param = `{"activityPrice":0,"activityStr":null,"address":null,"dates":null,"extend":null,"flag":"0","isBulkBooking":null,"isbookall":"0","isfreeman":"0","istimes":"1","mercacc":null,"merccode":null,"order":null,"orderfrom":null,"remark":null,"serviceid":null,"shoppingcart":"0","sno":null,"stock":{"${area.stockid}":"1"},"stockdetail":{"${area.stockid}":"${area.id}"},"stockdetailids":"928163","stockid":null,"subscriber":"0","time_detailnames":null,"userBean":null}`;
        let orderid = await this.searchInCart(area);
        if (orderid) {
            return orderid;
        }
        else {
            const res = await this.postFormData('https://gym.sysu.edu.cn/order/book.html', { param, json: true });
            return res.data.object ? res.data.object.orderid : null;
        }
    }
    async pay(orderid) {
        const param = `{"payid":2,"orderid":"${orderid}","ctypeindex":0}`; // payid = 2 表示使用运动经费支付
        const res = await this.postFormData('https://gym.sysu.edu.cn/pay/account/topay.html', { param, json: true });
        return res.data;
    }
    async searchInCart(area) {
        const res = await this.postFormData('https://gym.sysu.edu.cn/order/seachData.html', { orderid: '', id: '', page: '1', rows: '50' });
        if (res.data.rows?.length) {
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
    }
}

inquirer__default["default"].registerPrompt('datetime', datepicker__default["default"]);
async function run() {
    const answers = await getUserInfo(true);
    const gym = new GymPage();
    let isLogin = await gym.init();
    if (!isLogin) {
        const cas = new CasPage();
        cas.setUserInfo(answers.username, answers.password);
        let redirect = await cas.init();
        redirect = redirect || await cas.login();
        await gym.login(redirect);
        // gym.keepAlive(); no need for session cookie
    }
    else {
        console.log('账号已经登陆，已跳过登陆');
    }
    const services = await gym.getServices();
    const serviceAs = await inquirer__default["default"].prompt([
        {
            type: 'list',
            name: 'service',
            message: '选择预定地点: ',
            loop: false,
            choices: services.map(s => s[1])
        },
    ]);
    const service = services.find(s => s[1] === serviceAs['service']);
    gym.setServiceId(service ? service[0] : '30');
    const dateList = Array.from({ length: 10 }).map((v, i) => {
        const now = new Date(Date.now() + 3600 * 24 * 1000 * i);
        const year = '' + now.getFullYear();
        const month = ('0' + (now.getMonth() + 1)).substr(-2);
        const day = ('0' + (now.getDate())).substr(-2);
        return `${year}-${month}-${day}`;
    });
    const dateAs = await inquirer__default["default"].prompt([
        {
            type: 'list',
            name: 'date',
            message: '选择预定日期: ',
            loop: false,
            choices: dateList
        },
    ]);
    // console.log(dateList);
    gym.setDate(dateAs['date']);
    const timeList = await gym.getTimeList();
    if (!timeList.length) {
        console.log(`无可预定时间段，请确认场地是否可预定: http://gym.sysu.edu.cn/product/show.html?id=${gym.serviceId}`);
        return;
    }
    const timeAs = await inquirer__default["default"].prompt([
        {
            type: 'list',
            name: 'time',
            message: '选择时间: ',
            choices: timeList,
            loop: false,
        },
    ]);
    gym.setTime(timeAs['time']);
    const areas = await gym.getOkArea();
    if (!areas || !areas.length) {
        setTimeoutBooking(gym);
    }
    else {
        const areaAs = await inquirer__default["default"].prompt([
            {
                type: 'list',
                name: 'area',
                message: '选择场地: ',
                choices: areas.map((v) => v.sname),
                filter: function (val) {
                    return areas.find((area) => area.sname = val);
                },
                loop: false,
            },
        ]);
        let orderid = await gym.book(areaAs['area']);
        if (!orderid) {
            setTimeoutBooking(gym);
        }
        else {
            const payAs = await inquirer__default["default"].prompt([
                {
                    type: 'confirm',
                    name: 'pay',
                    message: `确定使用运动时支付场地(订单id[${orderid}])费用吗(Y/n): `,
                },
            ]);
            if (payAs['pay']) {
                console.log('正在支付...');
                const payResult = await gym.pay(orderid);
                console.log(payResult.message);
                console.log('请在个人中心查询订单信息: http://gym.sysu.edu.cn/order/showMyOrderDetail.html');
            }
        }
    }
}
async function sleep(sec, cb) {
    return new Promise((resolve, reject) => {
        const count = () => {
            sec--;
            cb(sec);
            if (sec <= 0) {
                resolve();
                return;
            }
            setTimeout(count, 1000);
        };
        count();
    });
}
function waitUntil(timestamp, loopCb) {
    return new Promise((resolve, reject) => {
        const loop = () => {
            const now = +new Date();
            if (now > timestamp) {
                resolve();
            }
            else {
                const remain = timestamp - now;
                loopCb(remain);
                setTimeout(loop, 1 * 1000);
            }
        };
        loop();
    });
}
async function setTimeoutBooking(gym) {
    console.log('选择预定的时间当前无可用场地，将使用定时预定');
    const toBookDateAs = await inquirer__default["default"].prompt([
        {
            type: 'datetime',
            name: 'dt',
            message: '请设置执行预定的时间: ',
            format: ['yyyy', '/', 'mm', '/', 'dd', ' ', 'hh', ':', 'MM', ' ', 'TT']
        }
    ]);
    const until = new Date(toBookDateAs['dt']);
    console.log(until.toLocaleString());
    await waitUntil(+until, (remain) => {
        const remainMsg = secondsFormat(remain / 1000);
        io.updateLine(`将在 ${remainMsg} 后执行预定( ctrl/cmd+c 取消进程)`);
    });
    delayBook(gym);
}
async function delayBook(gym, retry = 1) {
    let isLogin = await gym.init();
    if (!isLogin) {
        console.log('登陆过期，重新登陆...');
        const cas = new CasPage();
        let redirect = await cas.init();
        redirect = redirect || await cas.login();
        await gym.login(redirect);
    }
    const areas = await gym.getOkArea();
    const orderid = areas.length && await gym.book(areas[0]);
    if (!orderid) {
        io.updateLine(`[${new Date().toLocaleString()}][RETRY=${retry}]暂无可预定场地，将在5分钟后重试...`);
        setTimeout(() => {
            delayBook(gym, retry + 1);
        }, 5 * 60 * 1000);
    }
    else {
        await sleep(10, (n) => {
            io.updateLine(`将在${n}s后支付，订单id[${orderid}]( ctrl/cmd+c 取消进程)`);
        });
        const payResult = await gym.pay(orderid);
        console.log(payResult.message);
    }
}

run();
