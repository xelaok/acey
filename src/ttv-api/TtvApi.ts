import fetch from "node-fetch";
import qs from "qs";
import nanoid from "nanoid/generate";
import { logger, stopWatch, forget } from "../base";
import { TtvApiConfig } from "../config";
import { AppData } from "../app-data";
import * as aceApi from "../ace-api";

class TtvApi {
    session: string = "";

    private apiConfig: TtvApiConfig;
    private appData: AppData;

    constructor(apiConfig: TtvApiConfig, appData: AppData) {
        this.apiConfig = apiConfig;
        this.appData = appData;
    }

    async auth(): Promise<void> {
        if (!this.apiConfig.username || !this.apiConfig.password) {
            return;
        }

        const authData = await this.appData.readTtvAuth(this.apiConfig.username);

        if (authData) {
            this.session = authData.session;
            return;
        }

        logger.debug("TtvApi > auth ..");

        let guid = await this.appData.readTtvGuid();

        if (!guid) {
            guid = nanoid("0123456789abcdef", 32);
            forget(this.appData.writeTtvGuid(guid));
        }

        const url = `${this.apiConfig.endpoint}/v3/auth.php?${qs.stringify({
            username: this.apiConfig.username,
            password: this.apiConfig.password,
            application: "tsproxy",
            typeresult: "json",
            guid: guid,
        })}`;

        const result = await fetch(url).then(res => res.json());

        if (!result.success) {
            throw new Error(`TTV Auth error: ${result.error}`);
        }

        this.session = result.session;
        forget(this.appData.writeTtvAuth(this.apiConfig.username, { session: result.session }));

        logger.debug("TtvApi > auth > success");
        logger.debug(`- session: ${result.session}`);
        logger.debug(`- guid: ${guid}`);
    }

    async getRawChannels(): Promise<any> {
        logger.debug("TtvApi > request channels ..");

        const result = await this.makeRequest("channel_list");
        logger.debug(`TtvApi > request channels > success (items: ${result.channels.length})`);

        return result.channels;
    }

    async getRawChannelCategories(): Promise<any> {
        logger.debug("TtvApi > request channel categories ..");

        const result = await this.makeRequest("translation_category");
        logger.debug(`TtvApi > request channel categories > success (items: ${result.categories.length})`);

        return result.categories;
    }

    async getAceStreamSource(id: number): Promise<aceApi.StreamSource> {
        logger.debug(`TtvApi > request channel ace source (id: ${id}) ..`);

        const { timeText, result } = await stopWatch(() =>
            this.makeRequest("translation_stream", { channel_id: id })
        );

        logger.debug(`TtvApi > request channel ace source (id: ${id}) > success`);
        logger.debug(`- type: ${result.type}`);
        logger.silly(`- source: ${result.source}`);
        logger.debug(`- request time: ${timeText}`);

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

        const res = await fetch(`${this.apiConfig.endpoint}/v3/${path}.php?${query}`);
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

function parseAceStreamSourceType(type: string): aceApi.StreamSourceType {
    switch (type) {
        case "contentid":
            return aceApi.StreamSourceType.Cid;
        case "torrent":
            return aceApi.StreamSourceType.Torrent;
        default:
            throw new Error(`Unknown source type string: "${type}".`);
    }
}

export { TtvApi }
