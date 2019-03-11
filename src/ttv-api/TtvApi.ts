import fetch from "node-fetch";
import qs from "qs";
import { createLogger, createRandomIdGenerator, stopWatch, forget, Logger } from "../base";
import { TtvApiConfig } from "../config";
import { AppData } from "../app-data";
import * as aceApi from "../ace-api";

const generateGuid = createRandomIdGenerator(16, 32);

class TtvApi {
    session: string = "";

    private readonly config: TtvApiConfig;
    private readonly appData: AppData;
    private readonly logger: Logger;

    constructor(config: TtvApiConfig, appData: AppData) {
        this.config = config;
        this.appData = appData;
        this.logger = createLogger(c => c`{yellow TTV Api}`);
    }

    async auth(): Promise<void> {
        if (!this.config.username || !this.config.password) {
            return;
        }

        const authData = await this.appData.readTtvAuth(this.config.username);

        if (authData) {
            this.session = authData.session;
            return;
        }

        this.logger.debug("auth ..");

        let guid = await this.appData.readTtvGuid();

        if (!guid) {
            guid = generateGuid();
        }

        const url = `${this.config.endpoint}/v3/auth.php?${qs.stringify({
            username: this.config.username,
            password: this.config.password,
            application: "tsproxy",
            typeresult: "json",
            guid: guid,
        })}`;

        const result = await fetch(url).then(res => res.json());

        if (!result.success) {
            throw new Error(`TTV Auth error: ${result.error}`);
        }

        this.session = result.session;

        forget(this.appData.writeTtvGuid(guid));
        forget(this.appData.writeTtvAuth(this.config.username, { session: result.session }));

        this.logger.debug("auth > success", [
            c => c`session: {bold ${result.session}}`,
            c => c`guid: {bold ${guid || "null"}}`,
        ]);
    }

    async getRawChannels(): Promise<any> {
        this.logger.debug("request channels ..");

        const result = await this.makeRequest("channel_list");
        this.logger.debug(c => c`request channels > success (items: {bold ${result.channels.length}})`);

        return result.channels;
    }

    async getRawChannelCategories(): Promise<any> {
        this.logger.debug("request channel categories ..");

        const result = await this.makeRequest("translation_category");
        this.logger.debug(c => c`request channel categories > success (items: {bold ${result.categories.length}})`);

        return result.categories;
    }

    async getAceStreamSource(id: string): Promise<aceApi.AceStreamSource> {
        this.logger.debug(c => c`request channel ace source (id: {bold ${id}}) ..`);

        const { timeText, result } = await stopWatch(() =>
            this.makeRequest("translation_stream", { channel_id: id })
        );

        this.logger.debug(c => c`request channel ace source (id: {bold ${id}}) > success`, [
            c => c`type: {bold ${result.type}}`,
            c => c`request time: {bold ${timeText}}`,
        ]);

        this.logger.silly(c => c`channel ace source: {bold ${result.source}}`);

        return {
            type: parseAceStreamSourceType(result.type),
            value: result.source,
        };
    }

    private async makeRequest(path: string, params?: any): Promise<any> {
        const query = qs.stringify({
            ...(params || {}),
            typeresult: "json",
            session: this.session,
        });

        const res = await fetch(`${this.config.endpoint}/v3/${path}.php?${query}`, {
            timeout: this.config.requestTimeout,
        });

        const content = await res.text();

        let result: any;

        try {
            result = JSON.parse(content);
        }
        catch (err) {
            throw new Error(`TTV API: can't parse content (path: "${path}", params: ${JSON.stringify(params || null)})\n\n${content}`);
        }

        if (!result.success) {
            throw new Error(`TTV API request error: ${result.error} (path: "${path}", params: ${JSON.stringify(params || null)})`);
        }

        return result;
    }
}

function parseAceStreamSourceType(type: string): aceApi.AceStreamSourceType {
    switch (type) {
        case "contentid":
            return aceApi.AceStreamSourceType.Cid;
        case "torrent":
            return aceApi.AceStreamSourceType.Torrent;
        default:
            throw new Error(`Unknown source type string: "${type}".`);
    }
}

export { TtvApi }
