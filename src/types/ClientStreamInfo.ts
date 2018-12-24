import { StreamBase } from "./StreamBase";
import { StreamType } from "./StreamType";

type ClientStreamInfo = {
    stream: StreamBase,
    streamType: StreamType,
    sourceLabel: string,
};

export {
    ClientStreamInfo,
}
