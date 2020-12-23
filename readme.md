# SYSU球场预定脚本

这是一个用于自动预定球场的脚本，使用typescript编写
## 使用

在[Release](https://github.com/hjylxmhzq/sysu-gym-booking/releases "Release")中有包含了node.js运行环境的可执行文件

## 调试
### 安装运行环境

需要[node.js](https://nodejs.org)以及npm
- win

从官网下载安装程序 [node.js](https://nodejs.org)

- mac os

通过homebrew安装
```bash
brew install nodejs
```
- linux

通过包管理器安装
```bash
sudo apt install nodejs npm # ubuntu/debian
sudo yum install nodejs     # cent os
sudo pacman -S nodejs       # Arch/Manjaro</code></pre>
```
### 安装依赖

在根目录中执行
```bash
npm install
#OR
yarn
```

### 编译/运行
```bash
npm run build

npm run start
```

### 打包

默认使用pkg打包为二进制文件（如果需要）
```bash
npm run pkg
```

### 作为模块导入

当你需要添加自己的逻辑时，可以把sysu-gym-booking作为一个模块导入
#### 作为command line程序运行 
```javascript
import { run } from 'sysu-gym-booking';
run();

```
#### 作为函数运行

```javascript
import { run, book } from 'sysu-gym-booking';
//sample: book(username: string, password: string, date: string, time: string, serviceId: string, pay: boolean);
book('mynetid', '123456', '2020-12-12', '08:00-09:00', '30', true);
```
参数：
- username: string, netid
- password: string, 登陆密码
- date: string, 需要预定的日期, 格式为 yyyy-mm-dd 的字符串
- time: string, 需要预定的时间, 格式为 hh:mm-hh:mm 的字符串, 需要与预定页面上的时间一致
- serviceId: string, 场地类型, 可在预定页面url上找到相应id, 为字符串形式的数字
- pay: boolean, true直接支付，false只预定暂不支付

### 其它
有bug欢迎提交issue