import urljoin from "url-join";
import fetch, { Response } from "node-fetch";
import { createLogger, stopWatch, Logger } from "../base";
import { AceApiConfig } from "../config";
import { AceStreamSource, AceStreamInfo } from "./types";
import { extractPlaybackId } from "./utils/extractPlaybackId";
import { normalizeIProxyUrl } from "./utils/normalizeIProxyUrl";
import { formatStreamSourceQuery } from "./utils/formatStreamSourceQuery";
import { AceApiError } from "./errors";

class AceClient {
    private readonly config: AceApiConfig;
    private readonly logger: Logger;

    constructor(config: AceApiConfig) {
        this.config = config;
        this.logger = createLogger(c => c`{cyan Ace Client}`);
    }

    async getStreamInfo(source: AceStreamSource, sid: string): Promise<AceStreamInfo> {
        const url = this.formatApiUrl(
            `getstream?${formatStreamSourceQuery(source, sid)}&.mp4&format=json`,
        );

        const res = await this.makeRequest(url);
        const data = await res.json();

        if (data.error) {
            throw new AceApiError(data.error);
        }

        return {
            isLive: !!data.response["is_live"],
            statUrl: normalizeIProxyUrl(this.config.endpoint, data.response["stat_url"]),
            commandUrl: normalizeIProxyUrl(this.config.endpoint, data.response["command_url"]),
            playbackId: extractPlaybackId(data.response["playback_url"]),
            playbackUrl: normalizeIProxyUrl(this.config.endpoint, data.response["playback_url"]),
            playbackSessionId: data.response["playback_session_id"],
        };
    }

    async getStream(info: AceStreamInfo): Promise<Response> {
        return this.makeRequest(info.playbackUrl);
    }

    async stopStream(info: AceStreamInfo): Promise<Response> {
        this.logger.debug(c => c`stop stream ..`);
        try {
            const { timeText, result: response } = await stopWatch(async () => {
                return this.makeRequest(`${info.commandUrl}?method=stop`);
            });

            this.logger.debug(c => c`stop stream > success: {bold ${response.status.toString()}} ({bold ${timeText}})`);
        }
        catch (err) {
            this.logger.debug(c => c`stop stream > failed: {yellow ${err.toString()}}`);
        }

        return this.makeRequest(`${info.commandUrl}?method=stop`);
    }

    private formatApiUrl(path: string): string {
        return urljoin(this.config.endpoint, "ace", path);
    }

    private async makeRequest(url: string): Promise<Response> {
        let response;

        try {
            response = await fetch(url, {
                timeout: this.config.requestTimeout,
            });
        }
        catch (err) {
            throw new AceApiError(err.toString());
        }

        if (response.status !== 200) {
            throw new AceApiError(`Response status: ${response.status}, ${response.statusText}`);
        }

        return response;
    }
}

export { AceClient }
