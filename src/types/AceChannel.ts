import { ChannelGroup } from "./ChannelGroup";

type AceChannel = {
    name: string,
    group: ChannelGroup | null,
    cid: string,
}

export { AceChannel }
