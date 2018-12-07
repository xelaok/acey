import { Channel, TtvChannel } from "../types";

function getChannelsFromTtvChannels(ttvChannels: TtvChannel[]): Channel[] {
    const result: Channel[] = [];
    const addedNames = new Set();

    for (const c of ttvChannels) {
        if (!addedNames.has(c.name)) {
            result.push({
                id: Buffer.from(c.name).toString("hex"),
                name: c.name,
                category: c.category,
                cid: c.cid,
            });
            addedNames.add(c.name);
        }
    }

    return result;
}

export { getChannelsFromTtvChannels }
