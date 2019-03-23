import { Request } from "hapi";
import { ChannelRepository } from "../../channel-repository";
import { Channel, ChannelSourceType } from "../../types";

function parseChannel(
    request: Request,
    channelRepository: ChannelRepository,
): Channel | null {
    let source: ChannelSourceType;

    switch (request.params.channelSource) {
        case "ace":
            source = ChannelSourceType.Ace;
            break;
        default:
            return null;
    }

    return channelRepository.getChannel(source, request.params.channelId);
}

export { parseChannel }
