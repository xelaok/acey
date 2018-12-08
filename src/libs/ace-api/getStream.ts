import fetch, { Response } from "node-fetch";

async function getStream(iproxyPath: string, cid: string, sid: string): Promise<Response> {
    const url = `${iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${sid}`;
    return fetch(url);
}

export { getStream }
