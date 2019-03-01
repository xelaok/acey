import { Request } from "hapi";
import { ChannelRepository } from "../../channel-repository";
import { Channel, ChannelSource } from "../../types";

function parseChannel(
    request: Request,
    channelRepository: ChannelRepository,
): Channel | null {
    let source: ChannelSource;

    switch (request.params.channelSource) {
        case "ace":
            source = ChannelSource.Ace;
            break;
        case "ttv":
            source = ChannelSource.Ttv;
            break;
        default:
            return null;
    }

    return channelRepository.getChannel(source, request.params.channelId);
}

export { parseChannel }
