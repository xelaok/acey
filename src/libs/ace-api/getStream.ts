import fetch, { RequestInit, Response } from "node-fetch";

async function getStream(iproxyPath: string, cid: string, sid: string, requestInit?: RequestInit): Promise<Response> {
    const url = `${iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${sid}`;
    return fetch(url, requestInit);
}

export { getStream }
