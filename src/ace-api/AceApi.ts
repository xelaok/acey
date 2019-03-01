import urljoin from "url-join";
import fetch, { RequestInit, Response } from "node-fetch";
import { AceApiConfig } from "../config";
import { AceStreamSource, AceStreamInfo } from "./types";
import { extractPlaybackId } from "./utils/extractPlaybackId";
import { normalizeIProxyUrl } from "./utils/normalizeIProxyUrl";
import { formatStreamSourceQuery } from "./utils/formatStreamSourceQuery";

class AceApi {
    private readonly config: AceApiConfig;

    constructor(config: AceApiConfig) {
        this.config = config;
    }

    async getStreamInfo(source: AceStreamSource, sid: string): Promise<AceStreamInfo> {
        const url = this.formatApiUrl(`getstream?${formatStreamSourceQuery(source, sid)}&.mp4&format=json`);
        const res = await fetch(url);
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

    async getStream(info: AceStreamInfo, requestInit?: RequestInit): Promise<Response> {
        return fetch(info.playbackUrl, requestInit);
    }

    async stopStream(info: AceStreamInfo): Promise<Response> {
        return await fetch(`${info.commandUrl}?method=stop`);
    }

    private formatApiUrl(path: string): string {
        return urljoin(this.config.endpoint, "ace", path);
    }
}

export { AceApi }
