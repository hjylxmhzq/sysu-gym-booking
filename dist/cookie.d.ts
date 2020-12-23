export default class Cookie {
    private cache;
    private name;
    private cookieCacheFile;
    constructor(name: string);
    dump(): Promise<void>;
    restore(): Promise<void>;
    add(key: string, value: string): void;
    remove(key: string): void;
    parse(str: string, add?: boolean): string[];
    serialize(): string;
    clear(): void;
}
