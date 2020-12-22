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
<pre><code>brew install nodejs</code></pre>
- linux

通过包管理器安装
<pre><code>sudo apt install nodejs npm # ubuntu/debian
sudo yum install nodejs     # cent os
sudo pacman -S nodejs       # Arch/Manjaro</code></pre>

### 安装依赖

在根目录中
<pre><code>npm install
#OR
yarn</code></pre>

### 编译/运行

<pre><code>npm run build</code></pre>

<pre><code>npm run start</code></pre>

### 打包

默认使用pkg打包为二进制文件（如果需要）
<pre><code>npm run pkg</code></pre>

### 其它
有bug欢迎提交issue