import urljoin from "url-join";
import fetch, { Response } from "node-fetch";
import { AceApiConfig } from "../config";
import { AceStreamSource, AceStreamInfo } from "./types";
import { extractPlaybackId } from "./utils/extractPlaybackId";
import { normalizeIProxyUrl } from "./utils/normalizeIProxyUrl";
import { formatStreamSourceQuery } from "./utils/formatStreamSourceQuery";

class AceClient {
    private readonly config: AceApiConfig;

    constructor(config: AceApiConfig) {
        this.config = config;
    }

    async getStream(source: AceStreamSource, sid: string): Promise<Response> {
        const url = this.formatApiUrl(`getstream?${formatStreamSourceQuery(source, sid)}&.mp4`);
        return this.makeRequest(url);
    }

    async getStreamInfo(source: AceStreamSource, sid: string): Promise<AceStreamInfo> {
        const url = this.formatApiUrl(
            `getstream?${formatStreamSourceQuery(source, sid)}&.mp4&format=json`,
        );

        const res = await this.makeRequest(url);
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
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

    async getStreamByInfo(info: AceStreamInfo): Promise<Response> {
        return this.makeRequest(info.playbackUrl);
    }

    async stopStream(source: AceStreamSource, sid: string): Promise<Response> {
        const info = await this.getStreamInfo(source, sid);
        const url = `${info.commandUrl}?method=stop`;
        return this.makeRequest(url);
    }

    async stopStreamByInfo(info: AceStreamInfo): Promise<Response> {
        return this.makeRequest(`${info.commandUrl}?method=stop`);
    }

    private formatApiUrl(path: string): string {
        return urljoin(this.config.endpoint, "ace", path);
    }

    private makeRequest(url: string): Promise<Response> {
        return fetch(url, {
            timeout: this.config.requestTimeout,
        });
    }
}

export { AceClient }
