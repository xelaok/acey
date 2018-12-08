import fetch from "node-fetch";
import { getStreamFeatures } from "./getStreamFeatures";

async function stopStream(iproxyPath: string, cid: string, sid: string): Promise<void> {
    const features = await getStreamFeatures(iproxyPath, cid, sid);
    const url = `${features.commandUrl}?method=stop`;
    await fetch(url);
}

export { stopStream }
