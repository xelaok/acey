import fetch from "node-fetch";
import { formatStreamSourceQuery } from "./utils/formatStreamSourceQuery";
import { normalizeIProxyUrl } from "./utils/normalizeIProxyUrl";
import { StreamInfo, StreamSource } from "./types";

async function getStreamInfo(iproxyPath: string, source: StreamSource, sid: string): Promise<StreamInfo> {
    const url = `${iproxyPath}/ace/getstream?${formatStreamSourceQuery(source, sid)}&.mp4&format=json`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return {
        isLive: !!data.response["is_live"],
        statUrl: normalizeIProxyUrl(iproxyPath, data.response["stat_url"]),
        commandUrl: normalizeIProxyUrl(iproxyPath, data.response["command_url"]),
        playbackId: extractPlaybackId(data.response["playback_url"]),
        playbackUrl: normalizeIProxyUrl(iproxyPath, data.response["playback_url"]),
        playbackSessionId: data.response["playback_session_id"],
    };
}

function extractPlaybackId(playbackUrl: string): string {
    const pos2 = playbackUrl.lastIndexOf("/");
    const pos1 = playbackUrl.lastIndexOf("/", pos2 - 1);
    return playbackUrl.substring(pos1 + 1, pos2);
}

export { getStreamInfo }
