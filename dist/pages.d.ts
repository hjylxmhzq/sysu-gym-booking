/// <reference types="node" />
/// <reference types="cheerio" />
import Cookie from './cookie';
interface RequestHeaders {
    [key: string]: string;
}
export declare class Page {
    cookie: Cookie;
    protected defaultHeaders: RequestHeaders;
    constructor(cookieFileName: string);
    get(url: string, headers?: {}): Promise<any>;
    postFormData(url: string, data: any, headers?: {}): Promise<any>;
    parseHtml(html: string | Buffer): cheerio.Root;
    openLocalFile(fileOrUrl: string): void;
}
export declare class CasPage extends Page {
    refUrl: string;
    form: any;
    userInfo: {
        username: string;
        password: string;
    };
    constructor();
    init(refUrl?: string): Promise<any>;
    setUserInfo(username: string, password: string): void;
    login(retry?: number): Promise<string>;
    getCaptcha(show?: boolean): Promise<Buffer>;
    getLoginPage(refUrl: string): Promise<cheerio.Root>;
}
export declare class GymPage extends Page {
    keepAliveTimer: ReturnType<typeof setTimeout> | null;
    serviceId: string;
    date: string;
    time: string;
    constructor(serviceId?: string);
    init(): Promise<boolean>;
    login(urlWithTicket: string): Promise<void>;
    keepAlive(during?: number): void;
    destroy(): void;
    setServiceId(id?: string): void;
    setDate(date: string): void;
    getTimeList(): Promise<any>;
    getServices(): Promise<string[][]>;
    setTime(time: string): void;
    getOkArea(): Promise<any>;
    book(area: any): Promise<any>;
    pay(orderid: string): Promise<any>;
    private searchInCart;
}
export {};
