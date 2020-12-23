/// <reference types="node" />
export declare function secondsFormat(s: number): string;
export declare function solveCaptcha(img: Buffer): Promise<any>;
export declare function getUserInfo(showLog?: boolean): Promise<any>;
export declare class EasyDate {
    date: Date;
    constructor(...args: Parameters<typeof Date>);
    addDay(days: number): void;
    getDateStr(): string;
}
