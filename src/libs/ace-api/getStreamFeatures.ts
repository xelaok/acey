import fetch from "node-fetch";
import { normalizeIProxyUrl } from "./normalizeIProxyUrl";
import { StreamFeatures } from "./types";

async function getStreamFeatures(iproxyPath: string, cid: string, sid: string): Promise<StreamFeatures> {
    const url = `${iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${sid}&format=json`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return {
        playbackUrl: normalizeIProxyUrl(iproxyPath, data.response["playback_url"]),
        statUrl: normalizeIProxyUrl(iproxyPath, data.response["stat_url"]),
        commandUrl: normalizeIProxyUrl(iproxyPath, data.response["command_url"]),
        eventUrl: normalizeIProxyUrl(iproxyPath, data.response["event_url"]),
    };
}

export { getStreamFeatures }
