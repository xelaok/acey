import { Server, Request, ResponseToolkit } from "hapi";
import { logger } from "../libs/logger";
import { ChannelRepository } from "../services/ChannelRepository";
import { StreamProvider } from "../services/StreamProvider";

function handleGetChannelStream(
    server: Server,
    channelRepository: ChannelRepository,
    streamProvider: StreamProvider,
): void {
    server.route({
        method: "GET",
        path: "/c/{channelId}",
        handler: (request: Request, h: ResponseToolkit) => {
            const channel = channelRepository.get(request.params.channelId);

            if (!channel) {
                return h.response().code(404);
            }

            logger.verbose(`Request channel "${channel.name}"`);
            return streamProvider.request(channel.cid, channel.name, request, h);
        },
    });
}

export { handleGetChannelStream }
