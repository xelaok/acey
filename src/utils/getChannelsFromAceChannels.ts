import { Channel, AceChannel } from "../types";

function getChannelsFromAceChannels(aceChannels: AceChannel[]): Channel[] {
    const result: Channel[] = [];
    const addedNames = new Set();

    for (const c of aceChannels) {
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

export { getChannelsFromAceChannels }
