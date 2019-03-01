import { Request, ResponseToolkit, Server } from "hapi";
import { ChannelRepository } from "../../channel-repository";
import { Hls } from "../../hls";
import { parseChannel } from "../utils/parseChannel";

function hlsStream(
    server: Server,
    channelRepository: ChannelRepository,
    hls: Hls,
): void {
    server.route({
        method: "GET",
        path: "/s/{channelSource}/{channelId}/hls/{profile}/{filename}",
        handler: async (request: Request, h: ResponseToolkit) => {
            const channel = parseChannel(request, channelRepository);

            if (!channel) {
                return h.response().code(404);
            }

            return hls.handleRequest(
                request,
                h,
                channel,
                request.params.profile,
                request.params.filename,
            );
        },
    });
}

export { hlsStream }
