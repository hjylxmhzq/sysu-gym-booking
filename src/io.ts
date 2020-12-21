import readline from 'readline';

const io = {
  updateLine(text: string) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(text);
  }
}

export default io;