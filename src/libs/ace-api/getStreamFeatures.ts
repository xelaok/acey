import fetch from "node-fetch";
import { normalizeIProxyUrl } from "./normalizeIProxyUrl";
import { StreamFeatures } from "./types";

async function getStreamFeatures(iproxyPath: string, cid: string, sid: string): Promise<StreamFeatures> {
    const url = `${iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${sid}&format=json`;
    const res = await fetch(url);
    const json = await res.json();

    return {
        playbackUrl: normalizeIProxyUrl(iproxyPath, json.response["playback_url"]),
        statUrl: normalizeIProxyUrl(iproxyPath, json.response["stat_url"]),
        commandUrl: normalizeIProxyUrl(iproxyPath, json.response["command_url"]),
        eventUrl: normalizeIProxyUrl(iproxyPath, json.response["event_url"]),
    };
}

export { getStreamFeatures }
