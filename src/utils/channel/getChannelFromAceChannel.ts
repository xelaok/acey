import { Channel, AceChannel } from "../../types";

function getChannelFromAceChannel(aceChannel: AceChannel): Channel {
    return {
        id: Buffer.from(aceChannel.name).toString("hex"),
        name: aceChannel.name,
        group: aceChannel.group,
        cid: aceChannel.cid,
    };
}

export { getChannelFromAceChannel }
