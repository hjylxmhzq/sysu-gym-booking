import inquirer from 'inquirer';
import datepicker from 'inquirer-datepicker-prompt';
import io from './io';
import { CasPage, GymPage } from './pages';
import { getUserInfo, secondsFormat } from './utils';

inquirer.registerPrompt('datetime', datepicker as any);

export async function run() {
  const answers = await getUserInfo(true);
  const gym = new GymPage();
  let isLogin = await gym.init();
  if (!isLogin) {
    const cas = new CasPage();
    cas.setUserInfo(answers.username, answers.password);
    let redirect = await cas.init();
    redirect = redirect || await cas.login();
    let res = await gym.login(redirect);
    // gym.keepAlive(); no need for session cookie
  } else {
    console.log('账号已经登陆，已跳过登陆');
  }
  const services = await gym.getServices();
  const serviceAs = await inquirer.prompt([
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
  const timeList = await gym.getTimeList();
  if (!timeList.length) {
    console.log(`无可预定时间段，请确认场地是否可预定: http://gym.sysu.edu.cn/product/show.html?id=${gym.serviceId}`);
    return;
  }
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
    setTimeoutBooking(gym);
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
      setTimeoutBooking(gym);
    } else {
      const payAs = await inquirer.prompt([
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

function waitUntil(timestamp: number, loopCb: (remainTime: number) => void,) {
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

async function setTimeoutBooking(gym: GymPage) {
  console.log('选择预定的时间当前无可用场地，将使用定时预定');
  const toBookDateAs = await inquirer.prompt([
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
      io.updateLine(`将在${n}s后支付，订单id[${orderid}]( ctrl/cmd+c 取消进程)`);
    });
    const payResult = await gym.pay(orderid);
    console.log(payResult.message);
  }
}

export async function book(username: string, password: string, date: string, time: string, serviceId: string, pay = true) {
  const cas = new CasPage();
  cas.setUserInfo(username, password);
  let redirect = await cas.init();
  redirect = redirect || await cas.login();
  const gym = new GymPage();
  let res = await gym.login(redirect);
  gym.setServiceId(serviceId);
  gym.setDate(date);
  gym.setTime(time);
  const areas = await gym.getOkArea();
  const orderid = await gym.book(areas[0]);
  if (!orderid) return false;
  const payResult = pay && await gym.pay(orderid);
  return { status: payResult ? 'payed' : 'ordered', data: payResult ? payResult.message : orderid };
}
