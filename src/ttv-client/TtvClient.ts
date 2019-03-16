import fetch, { FetchError } from "node-fetch";
import qs from "qs";
import { createLogger, createRandomIdGenerator, stopWatch, forget, Logger, UserError } from "../base";
import { TtvApiConfig } from "../config";
import { AppData } from "../app-data";
import { AceStreamSource, AceStreamSourceType } from "../ace-client";
import { TtvApiError } from "./errors";

const generateGuid = createRandomIdGenerator(16, 32);

class TtvClient {
    private readonly config: TtvApiConfig;
    private readonly appData: AppData;
    private readonly logger: Logger;
    private guid: string | null;
    private session$: Promise<string | null> | null;
    private renewSessionTime: number | null;

    constructor(config: TtvApiConfig, appData: AppData) {
        this.config = config;
        this.appData = appData;
        this.logger = createLogger(c => c`{cyan TTV}`);
        this.guid = "";
        this.session$ = null;
        this.renewSessionTime = null;
    }

    isEnabled(): boolean {
        return !!this.config.username && !!this.config.password;
    }

    async getSession(): Promise<string | null> {
        if (!this.session$) {
            this.initSession();
        }

        return await this.session$;
    }

    async getRawChannels(): Promise<any> {
        this.logger.debug("request channels ..");

        const result = await this.makeSessionRequest("channel_list");
        this.logger.debug(c => c`request channels > success (items: {bold ${result.channels.length}})`);

        return result.channels;
    }

    async getRawChannelCategories(): Promise<any> {
        this.logger.debug("request channel categories ..");

        const result = await this.makeSessionRequest("translation_category");
        this.logger.debug(c => c`request channel categories > success (items: {bold ${result.categories.length}})`);

        return result.categories;
    }

    async getAceStreamSource(id: string): Promise<AceStreamSource> {
        this.logger.debug(c => c`request ace stream source (id: {bold ${id}}) ..`);

        try {
            const { timeText, result } = await stopWatch(() =>
                this.makeSessionRequest("translation_stream", { channel_id: id })
            );

            this.logger.debug(c => c`request ace stream source (id: {bold ${id}}) > success`, c => [
                c`type: {bold ${result.type}}`,
                c`request time: {bold ${timeText}}`,
                c`url: {bold ${result.source}}`,
            ]);

            return {
                type: parseAceStreamSourceType(result.type),
                value: result.source,
            };
        }
        catch (err) {
            this.logger.warn(c => c`request ace stream source (id: {bold ${id}}) > failed`, [
                err.toString(),
            ]);

            throw err;
        }
    }

    private async makeSessionRequest(path: string, params?: any): Promise<any> {
        if (!this.guid) {
            await this.initGuid();
        }

        if (!this.session$) {
            this.initSession();
        }

        let wasSessionRenewed = false;

        while (true) {
            const session = await this.session$;

            if (!session) {
                throw new UserError("Not authenticated. Can't do TTV request.");
            }

            const query = qs.stringify({
                ...(params || {}),
                typeresult: "json",
                session,
            });

            let content: string;
            try {
                const res = await fetch(`${this.config.endpoint}/v3/${path}.php?${query}`, {
                    timeout: this.config.requestTimeout,
                });

                content = await res.text();
            }
            catch (err) {
                switch (true) {
                    case err instanceof FetchError:
                        throw new TtvApiError(err.message);
                    default:
                        throw err;
                }
            }

            let result: any;
            try {
                result = JSON.parse(content);
            }
            catch (err) {
                throw new TtvApiError(`TTV API parse content error (path: "${path}", params: ${JSON.stringify(params || null)})\n\n${content}`);
            }

            if (!result.success && result.error === "incorrect" && !wasSessionRenewed) {
                this.renewSession();
                wasSessionRenewed = true;
                continue;
            }

            if (!result.success) {
                throw new TtvApiError(`TTV API request error: ${result.error} (path: "${path}", params: ${JSON.stringify(params || null)})`);
            }

            return result;
        }
    }

    private async initGuid(): Promise<void> {
        let guid = await this.appData.readTtvGuid();

        if (!guid) {
            guid = generateGuid();
            await this.appData.writeTtvGuid(guid);
        }

        this.guid = guid;
    }

    private initSession(): void {
        this.session$ = (async () => {
            const authData = await this.appData.readTtvAuth(this.config.username);
            let session = authData ? authData.session : null;

            if (session) {
                return session;
            }

            session = await this.requestSession();

            if (session) {
                await this.appData.writeTtvAuth(this.config.username, { session });
            }

            return session;
        })();
    }

    private renewSession(): void {
        const currentTime = Date.now();

        if (this.renewSessionTime && Date.now() - this.renewSessionTime < 1000 * 60 * 60) {
            return;
        }

        this.renewSessionTime = currentTime;

        this.session$ = (async () => {
            const session = await this.requestSession();

            if (session) {
                await this.appData.writeTtvAuth(this.config.username, { session });
            }

            return session;
        })();
    }

    private async requestSession(): Promise<string | null> {
        if (!this.config.username || !this.config.password) {
            return null;
        }

        const url = `${this.config.endpoint}/v3/auth.php?${qs.stringify({
            username: this.config.username,
            password: this.config.password,
            application: "tsproxy",
            typeresult: "json",
            guid: this.guid,
        })}`;

        let result: any;

        try {
            result = await fetch(url).then(res => res.json());
        }
        catch (err) {
            this.logger.warn("request session failed:", [err.toString()]);
            return null;
        }

        if (!result.success) {
            this.logger.warn("request session failed:", [result.error.toString()]);
            return null;
        }

        return result.session;
    }
}

function parseAceStreamSourceType(type: string): AceStreamSourceType {
    switch (type) {
        case "contentid":
            return AceStreamSourceType.Cid;
        case "torrent":
            return AceStreamSourceType.Torrent;
        default:
            throw new Error(`Unknown source type: "${type}".`);
    }
}

export { TtvClient }
