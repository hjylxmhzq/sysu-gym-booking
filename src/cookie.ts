import fs from 'fs';
import path from 'path';

export default class Cookie {
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