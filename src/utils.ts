import FormData from 'form-data';
import axios from 'axios';
import inquirer from 'inquirer';
import fs from 'fs';

const USER_INFO_FILE = './user-info.json';

export function secondsFormat(s: number) {
  const day = Math.floor(s / (24 * 3600)); // Math.floor()向下取整 
  const hour = Math.floor((s - day * 24 * 3600) / 3600);
  const minute = Math.floor((s - day * 24 * 3600 - hour * 3600) / 60);
  const second = (s - day * 24 * 3600 - hour * 3600 - minute * 60) >> 0;
  return day + "天" + hour + "时" + minute + "分" + second + "秒";
}

export async function solveCaptcha(img: Buffer) {
  const fd = new FormData();
  fd.append('img', img, { filename: 'captcha.jpg' });
  const res = await axios.post('http://tony-space.top:8989/captcha', fd.getBuffer(), {
    headers: {
      'Content-Type': fd.getHeaders()['content-type'],
      "Content-Length": fd.getLengthSync(),
    }
  });
  return res.data;
}

export async function getUserInfo(showLog = true) {
  if (fs.existsSync(USER_INFO_FILE)) {
    showLog && console.log('账号已保存，请妥善保管当前目录下的user-info.json，如果您想切换账号，请删除此文件');
    return JSON.parse(fs.readFileSync(USER_INFO_FILE).toString());
  }
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
    }
  ]);
  fs.writeFileSync(USER_INFO_FILE, JSON.stringify(answers, null, 2));
  return answers;
}

export class EasyDate extends Date {
  constructor() {
    super();
  }
  addDay(days: number) {
    this.setTime(this.getTime() + 3600 * 1000 * 24 * days);
  }
  getDateStr() {
    const day = ('0' + this.getDate()).substr(-2);
    const month = ('0' + (this.getMonth() + 1)).substr(-2);
    return '' + this.getFullYear() + '-' + month + '-' + day;
  }
}