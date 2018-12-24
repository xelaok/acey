import fetch, { Response } from "node-fetch";
import { getStreamInfo } from "./getStreamInfo";
import { StreamInfo, StreamSource } from "./types";

async function stopStream(iproxyPath: string, source: StreamSource, sid: string): Promise<Response> {
    const info = await getStreamInfo(iproxyPath, source, sid);
    const url = `${info.commandUrl}?method=stop`;
    return await fetch(url);
}

async function stopStreamByInfo(iproxyPath: string, info: StreamInfo): Promise<Response> {
    return await fetch(`${info.commandUrl}?method=stop`);
}

export {
    stopStream,
    stopStreamByInfo,
}
