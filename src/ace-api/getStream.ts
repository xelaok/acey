import fetch, { RequestInit, Response } from "node-fetch";
import { formatStreamSourceQuery } from "./utils/formatStreamSourceQuery";
import { StreamInfo, StreamSource } from "./types";

async function getStream(
    iproxyPath: string,
    source: StreamSource,
    sid: string,
    requestInit?: RequestInit
): Promise<Response> {
    const url = `${iproxyPath}/ace/getstream?${formatStreamSourceQuery(source, sid)}&.mp4`;
    return fetch(url, requestInit);
}

async function getStreamByInfo(
    iproxyPath: string,
    info: StreamInfo,
    requestInit?: RequestInit
): Promise<Response> {
    return fetch(info.playbackUrl, requestInit);
}

export {
    getStream,
    getStreamByInfo,
}
