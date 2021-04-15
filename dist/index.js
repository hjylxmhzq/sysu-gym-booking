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
exports.book = exports.run = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const datepicker = require('inquirer-datepicker-prompt');
const io_1 = __importDefault(require("./io"));
const pages_1 = require("./pages");
const utils_1 = require("./utils");
inquirer_1.default.registerPrompt('datetime', datepicker);
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const answers = yield utils_1.getUserInfo(true);
        const gym = new pages_1.GymPage();
        let isLogin = yield gym.init();
        if (!isLogin) {
            const cas = new pages_1.CasPage();
            cas.setUserInfo(answers.username, answers.password);
            let redirect = yield cas.init();
            redirect = redirect || (yield cas.login());
            let res = yield gym.login(redirect);
            // gym.keepAlive(); no need for session cookie
        }
        else {
            console.log('账号已经登陆，已跳过登陆');
        }
        const services = yield gym.getServices();
        const serviceAs = yield inquirer_1.default.prompt([
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
        const dateAs = yield inquirer_1.default.prompt([
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
        const timeList = yield gym.getTimeList();
        if (!timeList.length) {
            console.log(`无可预定时间段，请确认场地是否可预定: http://gym.sysu.edu.cn/product/show.html?id=${gym.serviceId}`);
            return;
        }
        const timeAs = yield inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'time',
                message: '选择时间: ',
                choices: timeList,
                loop: false,
            },
        ]);
        gym.setTime(timeAs['time']);
        const areas = yield gym.getOkArea();
        if (!areas || !areas.length) {
            setTimeoutBooking(gym);
        }
        else {
            const areaAs = yield inquirer_1.default.prompt([
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
            let orderid = yield gym.book(areaAs['area']);
            if (!orderid) {
                setTimeoutBooking(gym);
            }
            else {
                const payAs = yield inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'pay',
                        message: `确定使用运动时支付场地(订单id[${orderid}])费用吗(Y/n): `,
                    },
                ]);
                if (payAs['pay']) {
                    console.log('正在支付...');
                    const payResult = yield gym.pay(orderid);
                    console.log(payResult.message);
                    console.log('请在个人中心查询订单信息: http://gym.sysu.edu.cn/order/showMyOrderDetail.html');
                }
            }
        }
    });
}
exports.run = run;
function sleep(sec, cb) {
    return __awaiter(this, void 0, void 0, function* () {
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
function setTimeoutBooking(gym) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('选择预定的时间当前无可用场地，将使用定时预定');
        const toBookDateAs = yield inquirer_1.default.prompt([
            {
                type: 'datetime',
                name: 'dt',
                message: '请设置执行预定的时间: ',
                format: ['yyyy', '/', 'mm', '/', 'dd', ' ', 'hh', ':', 'MM', ' ', 'TT']
            }
        ]);
        const until = new Date(toBookDateAs['dt']);
        console.log(until.toLocaleString());
        yield waitUntil(+until, (remain) => {
            const remainMsg = utils_1.secondsFormat(remain / 1000);
            io_1.default.updateLine(`将在 ${remainMsg} 后执行预定( ctrl/cmd+c 取消进程)`);
        });
        delayBook(gym);
    });
}
function delayBook(gym, retry = 1) {
    return __awaiter(this, void 0, void 0, function* () {
        let isLogin = yield gym.init();
        if (!isLogin) {
            console.log('登陆过期，重新登陆...');
            const cas = new pages_1.CasPage();
            let redirect = yield cas.init();
            redirect = redirect || (yield cas.login());
            let res = yield gym.login(redirect);
        }
        const areas = yield gym.getOkArea();
        const orderid = areas.length && (yield gym.book(areas[0]));
        if (!orderid) {
            io_1.default.updateLine(`[${new Date().toLocaleString()}][RETRY=${retry}]暂无可预定场地，将在5分钟后重试...`);
            setTimeout(() => {
                delayBook(gym, retry + 1);
            }, 5 * 60 * 1000);
        }
        else {
            yield sleep(10, (n) => {
                io_1.default.updateLine(`将在${n}s后支付，订单id[${orderid}]( ctrl/cmd+c 取消进程)`);
            });
            const payResult = yield gym.pay(orderid);
            console.log(payResult.message);
        }
    });
}
function book(username, password, date, time, serviceId, pay = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const cas = new pages_1.CasPage();
        cas.setUserInfo(username, password);
        let redirect = yield cas.init();
        redirect = redirect || (yield cas.login());
        const gym = new pages_1.GymPage();
        let res = yield gym.login(redirect);
        gym.setServiceId(serviceId);
        gym.setDate(date);
        gym.setTime(time);
        const areas = yield gym.getOkArea();
        const orderid = yield gym.book(areas[0]);
        if (!orderid)
            return false;
        const payResult = pay && (yield gym.pay(orderid));
        return { status: payResult ? 'payed' : 'ordered', data: payResult ? payResult.message : orderid };
    });
}
exports.book = book;
//# sourceMappingURL=index.js.map