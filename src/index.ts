import cheerio from 'cheerio';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import inquirer from 'inquirer';
import FormData from 'form-data';
import axios from 'axios';
import datepicker from 'inquirer-datepicker-prompt';
import readline from 'readline';

inquirer.registerPrompt('datetime', datepicker as any);


interface RequestHeaders {
  [key: string]: string;
}

class Cookie {
  private cache: { [key: string]: string }
  private name: string;
  private cookieCacheFile: string;
  constructor(name: string) {
    this.cache = {};
    this.name = name;
    this.cookieCacheFile = path.resolve(process.cwd(), name + '.dat');
  }
  async dump() {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(this.cookieCacheFile, JSON.stringify(this.cache, null, 2), (err) => {
        if (err) {
          reject('Write cookie cache file error.');
        } else {
          resolve();
        }
      });
    })
  }
  restore() {
    return new Promise<void>((resolve, reject) => {
      if (!fs.existsSync(this.cookieCacheFile)) {
        resolve();
        return;
      }
      fs.readFile(this.cookieCacheFile, (err, data) => {
        if (err) {
          reject('Write cookie cache file error.');
        }
        this.cache = JSON.parse(data.toString());
        resolve();
      })
    })
  }
  add(key: string, value: string) {
    this.cache[key] = value;
  }
  remove(key: string) {
    delete this.cache[key];
  }
  parse(str: string, add = true) {
    const content = str.split(';')[0];
    const matches = content.match(/(.+)=(.+)/);
    if (!matches) return [];
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

class Page {
  protected cookie: Cookie;
  protected defaultHeaders: RequestHeaders;
  constructor(cookieFileName: string) {
    this.cookie = new Cookie(cookieFileName);
    this.defaultHeaders = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
    }
  }
  async get(url: string, headers = {}) {
    const options = {
      maxRedirects: 0,
      validateStatus: function (status: number) {
        return status >= 200 && status < 400;
      },
      headers: {
        Cookie: this.cookie.serialize(),
        ...this.defaultHeaders,
        ...headers
      }
    };
    return axios.get(url, options).catch(err => {
      return err;
    });
  }
  async postFormData(url: string, data: any, headers = {}) {
    const fd = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      fd.append(key, value ? String(value) : '');
    });
    return axios({
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
  parseHtml(html: string | Buffer) {
    const $ = cheerio.load(html);
    return $;
  }
  openLocalFile(fileOrUrl: string) {
    let cmd = '';
    if (fileOrUrl.startsWith('http')) {
      if (process.platform == 'win32') {
        cmd = 'start "%ProgramFiles%\Internet Explorer\iexplore.exe" ';
      } else {
        cmd = 'start ';
      }
    }
    if (process.platform == 'linux') {
      cmd = 'xdg-open ';
    } else if (process.platform == 'darwin') {
      cmd = 'open ';
    }
    exec(`${cmd}"${fileOrUrl}"`);
  }
}

class CasPage extends Page {
  refUrl: string;
  form: any;
  constructor() {
    super('caspage_cookie');
    this.refUrl = '';

    this.form = {
      username: 'hujy35',
      password: 'Hjyqwe098',
      captcha: 'v7ex',
      execution: '',
      _eventId: 'submit',
      submit: 'LOGIN',
      geolocation: ''
    }
  }

  async init(refUrl = 'http://gym.sysu.edu.cn/login/pre.html') {
    await this.cookie.restore();
    const res = await this.get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, { Host: 'cas.sysu.edu.cn' });
    if (res.response && res.response.status === 302) {
      return res.response.headers['location'];
    }
    console.log(res.request._header)
    this.refUrl = refUrl;
    const $ = await this.getLoginPage(refUrl);
    this.form.execution = ($('#fm1 input[name="execution"]')[0] as cheerio.TagElement).attribs.value;
  }

  async login() {
    if (!this.refUrl) throw new Error('method init() should be called before login()')
    await this.getCaptcha();
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'NetId: '
      },
      {
        type: 'password',
        name: 'password',
        message: '密码: '
      },
      {
        type: 'input',
        name: 'captcha',
        message: '验证码: '
      },
    ]);

    this.form.username = answers['username'];
    this.form.password = answers['password'];
    this.form.captcha = answers['captcha'];

    const res = await this.postFormData(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, this.form, { Host: 'cas.sysu.edu.cn' });
    if (!res || res.status !== 302) {
      throw new Error('login error, please check your password and captcha');
    }
    try {
      res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie: string) => {
        this.cookie.parse(cookie);
      }));
      await this.cookie.dump();
      return res.headers['location'];
    } catch (e) {
      throw e;
    }
  }

  async getCaptcha() {
    axios.get('https://cas.sysu.edu.cn/cas/captcha.jsp', { headers: { Cookie: this.cookie.serialize() }, responseType: 'arraybuffer' }).then(async res => {
      const data = res.data;
      const tmpFilePath = path.resolve(os.tmpdir(), 'temp_captcha.jpg');
      await new Promise((resolve, reject) => {
        fs.writeFile(tmpFilePath, data, err => {
          if (err) {
            reject(err);
          } else {
            resolve(tmpFilePath);
          }
        });
      });
      this.openLocalFile(tmpFilePath);
      tmpFilePath
    })
  }

  async getLoginPage(refUrl: string) {
    return axios.get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(refUrl)}`, { headers: { Host: 'cas.sysu.edu.cn', ...this.defaultHeaders } }).then(res => {
      const headers = res.headers;
      this.cookie.parse(headers['set-cookie'][0]);
      const $ = this.parseHtml(res.data);
      return $;
    });
  }
}


class GymPage extends Page {
  keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
  serviceId = '30';
  date = '';
  time = '';
  constructor() {
    super('gympage_cookie');
  }

  async init() {
    await this.cookie.restore();
    const res = await this.get('http://gym.sysu.edu.cn/index.html');
    fs.writeFileSync('temp.html', res.data);
    const $ = this.parseHtml(res.data);
    const usernameEl = $('#onlinename');
    return !!usernameEl.length;
  }
  async login(urlWithTicket: string) {
    const res = await this.get(urlWithTicket);
    res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie: string) => {
      this.cookie.parse(cookie);
    }));
    await this.cookie.dump();
  }
  keepAlive() {
    const loop = async () => {
      const res = await this.get('http://gym.sysu.edu.cn/index.html');
      res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie: string) => {
        this.cookie.parse(cookie);
      }));
      this.keepAliveTimer = setTimeout(() => {
        loop();
      }, 5000);
    }
    loop();
  }
  destroy() {
    this.keepAliveTimer && clearTimeout(this.keepAliveTimer);
  }
  setServiceId(id = '30') { // 设置场地类型： 乒乓球 30/羽毛球 61等
    this.serviceId = id;
  }
  setDate(date: string) {
    this.date = date;
  }
  async getTimeList() {
    const res = await this.get(`http://gym.sysu.edu.cn/product/getarea2.html?s_dates=${this.date}&serviceid=${this.serviceId}&type=day`);
    return res.data.timeList.map((item: any) => item.TIME_NO);
  }
  setTime(time: string) {
    this.time = time;
  }
  async getOkArea() {
    const res = await this.get(`http://gym.sysu.edu.cn/product/findOkArea.html?s_date=${this.date}&serviceid=${this.serviceId}`);
    const areas = res.data.object && res.data.object.filter((area: any) => area.stock.time_no === this.time && area.status === 1); // status === 1 表示场地可预定
    return areas || [];
  }
  async book(area: any) {
    const param = `{"activityPrice":0,"activityStr":null,"address":null,"dates":null,"extend":null,"flag":"0","isBulkBooking":null,"isbookall":"0","isfreeman":"0","istimes":"1","mercacc":null,"merccode":null,"order":null,"orderfrom":null,"remark":null,"serviceid":null,"shoppingcart":"0","sno":null,"stock":{"${area.stockid}":"1"},"stockdetail":{"${area.stockid}":"${area.id}"},"stockdetailids":"928163","stockid":null,"subscriber":"0","time_detailnames":null,"userBean":null}`;
    let orderid = await this.searchInCart(area);
    if (orderid) {
      return orderid;
    } else {
      const res = await this.postFormData('http://gym.sysu.edu.cn/order/book.html', { param, json: true });
      return res.data.object ? res.data.object.orderid : null
    }
  }
  async pay(orderid: string) {
    const param = `{"payid":2,"orderid":"${orderid}","ctypeindex":0}`; // payid = 2 表示使用运动经费支付
    const res = await this.postFormData('http://gym.sysu.edu.cn/pay/account/topay.html', { param, json: true });
    return res.data;
  }
  private async searchInCart(area: any) {
    const res = await this.postFormData('http://gym.sysu.edu.cn/order/seachData.html', { orderid: '', id: '', page: '1', rows: '50' });
    if (res.data.rows?.length) {
      const data = res.data.rows.filter((item: any) => {
        return item.stockid === area.stockid && item.stockdetailid === area.id && item.status === 0; // status === 0 为预定中状态
      });
      if (data.length) {
        return data[0].orderid;
      }
    } else {
      return null;
    }
  }
}

async function run() {
  const gym = new GymPage();
  let isLogin = await gym.init();
  if (!isLogin) {
    const cas = new CasPage();
    let redirect = await cas.init();
    redirect = redirect || await cas.login();
    let res = await gym.login(redirect);
    gym.keepAlive();
  } else {
    console.log('账号已经登陆，已跳过登陆');
  }
  const dateList = Array.from({ length: 10 }).map((v, i) => {
    const now = new Date(Date.now() + 3600 * 24 * 1000 * i);
    const year = '' + now.getFullYear();
    const month = ('0' + (now.getMonth() + 1)).substr(-2);
    const day = ('0' + (now.getDate())).substr(-2);
    return `${year}-${month}-${day}`;
  });
  const dateAs = await inquirer.prompt([
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
  gym.setServiceId('30');
  const timeList = await gym.getTimeList();
  const timeAs = await inquirer.prompt([
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
    console.log('选择预定的时间当前无可用场地，将在场地可用时自动预定');
    delayBook(gym);
  } else {
    const areaAs = await inquirer.prompt([
      {
        type: 'list',
        name: 'area',
        message: '选择场地: ',
        choices: areas.map((v: any) => v.sname),
        filter: function (val) { // 使用filter将回答变为小写
          return areas.find((area: any) => area.sname = val);
        },
        loop: false,
      },
    ]);
    const orderid = await gym.book(areaAs['area']);
    if (!orderid) {
      console.log('选择预定的时间当前无可用场地，将在场地可用时自动预定');
      delayBook(gym);
    } else {
      const payAs = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'pay',
          message: `确定使用运动时支付场地(订单id[${orderid}])费用吗(y/N): `,
        },
      ]);
      if (payAs['pay']) {
        console.log('正在支付...');
        const payResult = await gym.pay(orderid);
        console.log(payResult.message);
      }
    }
  }
}

async function sleep(sec: number, cb: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const count = () => {
      sec--;
      cb(sec);
      if (sec <= 0) {
        resolve();
        return;
      }
      setTimeout(count, 1000);
    }
    count();
  })
}

async function delayBook(gym: GymPage) {
  const areas = await gym.getOkArea();
  const orderid = areas.length && await gym.book(areas[0]);
  if (!orderid) {
    console.log('暂无可预定场地，将在10分钟后重试');
    setTimeout(() => {
      delayBook(gym);
    }, 10 * 60 * 1000);
  } else {
    await sleep(10, (n) => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`将在${n}s后支付，( ctrl/cmd+c 取消进程)`);
    });
    const orderid = await gym.book(areas[0]);
    const payResult = await gym.pay(orderid);
    console.log(payResult.message);
  }
}

run();

async function runDev() {
  const gym = new GymPage();
  let isLogin = await gym.init();
  if (!isLogin) {
    const cas = new CasPage();
    let redirect = await cas.init();
    redirect = redirect || await cas.login();
    let res = await gym.login(redirect);
  } else {
    console.log('Already login, skip login process');
  }
  gym.setDate('2020-12-22');
  gym.setServiceId('30');
  const timeList = await gym.getTimeList();
  gym.setTime(timeList[0]);
  const areas = await gym.getOkArea();
  if (!areas || !areas.length) {
    console.log('选择预定的时间当前无可用场地，将在场地可用时自动预定');
    delayBook(gym);
  } else {
    await sleep(10, (n) => {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`将在${n}s后支付，( ctrl/cmd+c 取消进程)`);
    });
    const orderid = await gym.book(areas[0]);
    const payResult = await gym.pay(orderid);
    console.log(payResult.message);
  }
}

// runDev();
