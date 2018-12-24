import fs from "fs";
import path from "path";
import mkdirp from "mkdirp";
import clone from "clone";

import {
    getAppDataPath,
    encodeBase64String,
    decodeBase64String,
    FetchContentResult,
} from "../base";

import { AppConfig } from "../config";

type TtvAuthData = {
    session: string,
};

type TtvAuthDataList = Array<{
    username: string,
    data: TtvAuthData,
}>;

type TtvGuidData = string;

type TtvSourceRawData = {
    lastFetched: number,
    rawChannels: string,
    rawChannelCategories: string,
};

type TtvSourceRawDataList = Array<{
    session: string,
    data: TtvSourceRawData,
}>;

type TtvSourceData = {
    lastFetched: number,
    rawChannels: any[],
    rawChannelCategories: any[],
};

type AceSourceData = {
    lastFetched: number,
    fetchResult: FetchContentResult,
};

type AceSourceDataList = Array<{
    url: string,
    data: AceSourceData,
}>;

const Entities = {
    TtvAuth: "ttvAuth",
    TtvGuid: "ttvGuid",
    TtvSource: "ttvSource",
    AceSource: "aceSource",
};

class AppData {
    private dataPath: string;

    constructor(appConfig: AppConfig) {
        this.dataPath = getAppDataPath(appConfig.dataDirectory);
    }

    async init(): Promise<void> {
        await this.makeDataDir();
    }

    async readTtvGuid(): Promise<TtvGuidData | null> {
        return this.readData(Entities.TtvGuid);
    }

    async readTtvAuth(username: string): Promise<TtvAuthData | null> {
        const list = await this.readData<TtvAuthDataList>(Entities.TtvAuth);

        if (!list) {
            return null;
        }

        const item = list.find(i => i.username === username);

        if (!item) {
            return null;
        }

        return item.data;
    }

    async readTtvSource(session: string): Promise<TtvSourceData | null> {
        const list = await this.readData<TtvSourceRawDataList>(Entities.TtvSource);

        if (!list) {
            return null;
        }

        const item = list.find(i => i.session === session);

        if (!item) {
            return null;
        }

        const data = item.data;

        return {
            lastFetched: data.lastFetched,
            rawChannels: JSON.parse(decodeBase64String(data.rawChannels)),
            rawChannelCategories: JSON.parse(decodeBase64String(data.rawChannelCategories)),
        };
    }

    async readAceSource(url: string): Promise<AceSourceData | null> {
        const list = await this.readData<AceSourceDataList>(Entities.AceSource);

        if (!list) {
            return null;
        }

        const item = list.find(i => i.url === url);
        const data = item ? item.data : null;

        if (data) {
            data.fetchResult.content = decodeBase64String(data.fetchResult.content);
        }

        return data;
    }

    async writeTtvGuid(guid: string): Promise<void> {
        await this.writeData(Entities.TtvGuid, guid);
    }

    async writeTtvAuth(username: string, data: TtvAuthData): Promise<void> {
        let list = await this.readData<TtvAuthDataList>(Entities.TtvAuth);

        if (!list) {
            list = [];
        }

        const item = list.find(i => i.username === username);

        if (item) {
            item.data = data;
        }
        else {
            list.push({
                username,
                data,
            });
        }

        await this.writeData(Entities.TtvAuth, list);
    }

    async writeTtvSource(session: string, data: TtvSourceData): Promise<void> {
        const rawData: TtvSourceRawData = {
            lastFetched: data.lastFetched,
            rawChannels: encodeBase64String(JSON.stringify(data.rawChannels)),
            rawChannelCategories: encodeBase64String(JSON.stringify(data.rawChannelCategories)),
        };

        let list = await this.readData<TtvSourceRawDataList>(Entities.TtvSource);

        if (!list) {
            list = [];
        }

        const item = list.find(i => i.session === session);

        if (item) {
            item.data = rawData;
        }
        else {
            list.push({
                session,
                data: rawData,
            });
        }

        await this.writeData(Entities.TtvSource, list);
    }

    async writeAceSource(url: string, data: AceSourceData): Promise<void> {
        const rawData = clone(data);
        rawData.fetchResult.content = encodeBase64String(rawData.fetchResult.content);

        let list = await this.readData<AceSourceDataList>(Entities.AceSource);

        if (!list) {
            list = [];
        }

        const item = list.find(i => i.url === url);

        if (item) {
            item.data = rawData;
        }
        else {
            list.push({
                url,
                data: rawData,
            });
        }

        await this.writeData(Entities.AceSource, list);
    }


    private async makeDataDir(): Promise<void> {
        return new Promise((resolve, reject) => {
            mkdirp(this.dataPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            })
        });
    }

    private async readData<T>(name: string): Promise<T | null> {
        return new Promise((resolve, reject) => {
            const filename = path.join(this.dataPath, name + ".json");

            fs.readFile(filename, "utf8", (err, data) => {
                if (err) {
                    resolve(null);
                    return;
                }

                resolve(JSON.parse(data));
            });
        });
    }

    private async writeData<T>(name: string, data: T): Promise<void> {
        return new Promise((resolve, reject) => {
            const filename = path.join(this.dataPath, name + ".json");

            fs.writeFile(filename, JSON.stringify(data, null, "\t"), (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

export { AppData }
