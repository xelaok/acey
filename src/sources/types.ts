import { StreamBase, StreamType } from "../types";

type GetStreamsResult = {
    streams: StreamBase[],
    streamType: StreamType,
};

interface Source {
    start(): Promise<void>;
    stop(): void;
    getStreams(): GetStreamsResult;
}

export {
    Source,
    GetStreamsResult,
}
