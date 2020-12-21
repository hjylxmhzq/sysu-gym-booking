import inquirer from 'inquirer';
import datepicker from 'inquirer-datepicker-prompt';
import io from './io';
import { CasPage, GymPage } from './pages';
import { secondsFormat } from './utils';

inquirer.registerPrompt('datetime', datepicker as any);

async function run() {
  const gym = new GymPage();
  let isLogin = await gym.init();
  if (!isLogin) {
    const cas = new CasPage();
    let redirect = await cas.init();
    redirect = redirect || await cas.login();
    let res = await gym.login(redirect);
    // gym.keepAlive(); no need for session cookie
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
    let orderid = await gym.book(areaAs['area']);
    if (!orderid) {
      console.log('选择预定的时间当前无可用场地，将在使用定时预定');
      const toBookDateAs = await inquirer.prompt([
        {
          type: 'datetime',
          name: 'dt',
          message: '请设置预定时间: ',
          format: ['yyyy', '/', 'mm', '/', 'dd', ' ', 'hh', ':', 'MM', ' ', 'TT']
        }
      ]);
      const until = new Date(toBookDateAs['dt']);
      console.log(until.toLocaleString());
      await waitUntil(+until, (remain) => {
        const remainMsg = secondsFormat(remain / 1000);
        io.updateLine(`将在 ${remainMsg} 后执行预定`);
      });
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

function waitUntil(timestamp: number, loopCb: (remainTime: number) => void, ) {
  return new Promise<void>((resolve, reject) => {
    const loop = () => {
      const now = +new Date();
      if (now > timestamp) {
        resolve();
      } else {
        const remain = timestamp - now;
        loopCb(remain);
        setTimeout(loop, 1 * 1000);
      }
    }
    loop();
  })
}

async function delayBook(gym: GymPage, retry = 1) {
  let isLogin = await gym.init();
  if (!isLogin) {
    console.log('登陆过期，重新登陆...');
    const cas = new CasPage();
    let redirect = await cas.init();
    redirect = redirect || await cas.login();
    let res = await gym.login(redirect);
  }
  const areas = await gym.getOkArea();
  const orderid = areas.length && await gym.book(areas[0]);
  if (!orderid) {
    io.updateLine(`[${new Date().toLocaleString()}][RETRY=${retry}]暂无可预定场地，将在5分钟后重试...`);
    setTimeout(() => {
      delayBook(gym, retry + 1);
    }, 5 * 60 * 1000);
  } else {
    await sleep(10, (n) => {
      io.updateLine(`将在${n}s后支付，订单id[${orderid}]，( ctrl/cmd+c 取消进程)`);
    });
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
      io.updateLine(`将在${n}s后支付，( ctrl/cmd+c 取消进程)`);
    });
    const orderid = await gym.book(areas[0]);
    const payResult = await gym.pay(orderid);
    console.log(payResult.message);
  }
}

// runDev();
