export declare function run(): Promise<void>;
export declare function book(username: string, password: string, date: string, time: string, serviceId: string, pay?: boolean): Promise<false | {
    status: string;
    data: any;
}>;
