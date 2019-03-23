import fs from "fs";
import path from "path";
import clone from "clone";
import fse from "fs-extra";

import {
    getAppDataPath,
    encodeBase64String,
    decodeBase64String,
    FetchContentResult,
} from "../base";

import { AppConfig } from "../config";

type AceSourceData = {
    lastFetched: number;
    fetchResult: FetchContentResult;
};

type AceSourceDataList = Array<{
    url: string;
    data: AceSourceData;
}>;

const Entities = {
    AceSource: "aceSource",
};

class AppData {
    dataPath: string;

    constructor(config: AppConfig) {
        this.dataPath = getAppDataPath(config.dataDirectory);
    }

    async init(): Promise<void> {
        await fse.mkdirp(this.dataPath);
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
