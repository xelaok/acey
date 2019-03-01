import { Channel } from "../types";

type ChannelSourceInfo = {
    channel: Channel;
    sourceLabel: string;
};

interface ChannelSourceWorker {
    open(): Promise<void>;
    close(): Promise<void>;
    getChannels(): Channel[];
}

export { ChannelSourceInfo, ChannelSourceWorker }
