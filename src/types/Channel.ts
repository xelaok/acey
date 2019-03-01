import { ChannelGroup } from "./ChannelGroup";
import { ChannelSource } from "./ChannelSource";

type Channel = {
    id: string;
    name: string;
    logoUrl: string | null;
    group: ChannelGroup | null;
    source: ChannelSource;
};

export { Channel }
