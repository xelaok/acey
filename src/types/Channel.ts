import { ChannelGroup } from "./ChannelGroup";
import { ChannelSourceType } from "./ChannelSourceType";

type Channel = {
    id: string;
    name: string;
    logoUrl: string | null;
    group: ChannelGroup | null;
    source: ChannelSourceType;
};

export { Channel }
