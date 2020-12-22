import cheerio from 'cheerio';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import FormData from 'form-data';
import axios from 'axios';
import Cookie from './cookie';
import io from './io';
import { getUserInfo, solveCaptcha, EasyDate } from './utils';

interface RequestHeaders {
  [key: string]: string;
}

export class Page {
  public cookie: Cookie;
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

export class CasPage extends Page {
  refUrl: string;
  form: any;
  constructor() {
    super('caspage_cookie');
    this.refUrl = '';

    this.form = {
      username: '',
      password: '',
      captcha: '',
      execution: '',
      _eventId: 'submit',
      submit: 'LOGIN',
      geolocation: ''
    }
  }

  async init(refUrl = 'http://gym.sysu.edu.cn/login/pre.html') {
    // await this.cookie.restore();
    const res = await this.get(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, { Host: 'cas.sysu.edu.cn' });
    if (res.response && res.response.status === 302) {
      return res.response.headers['location'];
    }
    this.refUrl = refUrl;
    const $ = await this.getLoginPage(refUrl);
    this.form.execution = ($('#fm1 input[name="execution"]')[0] as cheerio.TagElement).attribs.value;
  }

  async login(retry = 1): Promise<string> {
    if (!this.refUrl) throw new Error('method init() should be called before login()')
    const captchaBuf = await this.getCaptcha();
    const captcha = await solveCaptcha(captchaBuf);
    const answers = await getUserInfo(retry <= 1);

    this.form.username = answers['username'];
    this.form.password = answers['password'];
    this.form.captcha = captcha;

    const res = await this.postFormData(`https://cas.sysu.edu.cn/cas/login?service=${encodeURIComponent(this.refUrl)}`, this.form, { Host: 'cas.sysu.edu.cn' });
    if (!res || res.status !== 302) {
      if (retry > 10) {
        throw new Error('Login error, please check your netid and password');
      } else {
        return this.login(retry + 1);
      }
    } else {
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
  }

  async getCaptcha(show = false) {
    return new Promise<Buffer>((resolveOut, rejectOut) => {
      axios.get('https://cas.sysu.edu.cn/cas/captcha.jsp', { headers: { Cookie: this.cookie.serialize() }, responseType: 'arraybuffer' }).then(async res => {
        const data = res.data;
        const tmpFilePath = path.resolve(os.tmpdir(), 'temp_captcha.jpg');
        await new Promise<void>((resolve, reject) => {
          fs.writeFile(tmpFilePath, data, err => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        show && this.openLocalFile(tmpFilePath);
        resolveOut(data);
      });
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


export class GymPage extends Page {
  keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
  serviceId: string;
  date = '';
  time = '';
  constructor(serviceId = '61') {
    super('gympage_cookie');
    this.serviceId = serviceId;
  }

  async init() {
    // await this.cookie.restore();
    const res = await this.get('http://gym.sysu.edu.cn/index.html');
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
  keepAlive(during = 600 /* seconds */) {
    const loop = async () => {
      const res = await this.get('http://gym.sysu.edu.cn/index.html');
      io.updateLine(`Heartbeat request is sent [${new Date().toLocaleString()}]`);
      res.headers['set-cookie'] && (res.headers['set-cookie'].forEach((cookie: string) => {
        this.cookie.parse(cookie);
        this.cookie.dump();
      }));
      const isLogin = await this.init();
      if (!isLogin) {
        console.log('已退出登陆');
        return;
      }
      this.keepAliveTimer = setTimeout(() => {
        loop();
      }, during * 1000);
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
    const now = new EasyDate();
    if (this.date !== now.getDateStr()) { // 当预定非当天的球场时，获取下一天的时间表，以免获取不到完整时间表
      now.addDay(1);
    }
    const res = await this.get(`http://gym.sysu.edu.cn/product/getarea2.html?s_dates=${now.getDateStr()}&serviceid=${this.serviceId}&type=day`);
    return res.data.timeList.map((item: any) => item.TIME_NO);
  }
  async getServices() {
    const res = await this.get(`http://gym.sysu.edu.cn/product/index.html`);
    const $ = this.parseHtml(res.data);
    const items = $('.item-ul li');
    const services = [];
    const lnks = items.find('a');
    const names = items.find('dl > dd > h5');
    for (let i = 0; i < items.length; i++) {
      const link = (lnks[i] as cheerio.TagElement).attribs.href || '';
      const matchId = link.match(/\?id=(\d+)/);
      const name = (names[i] as cheerio.TagElement).children[0].data;
      if (matchId && name) {
        services.push([matchId[1], name]);
      }
    }
    return services;
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