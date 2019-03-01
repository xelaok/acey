import { Request, ResponseToolkit, Server } from "hapi";
import { ServerConfig } from "../../config";
import { ChannelRepository } from "../../channel-repository";
import { Hls } from "../../hls";
import { formatSecureRoutePath } from "../utils/formatSecureRoutePath";
import { parseChannel } from "../utils/parseChannel";

function hlsStream(
    server: Server,
    serverConfig: ServerConfig,
    channelRepository: ChannelRepository,
    hls: Hls,
): void {
    server.route({
        method: "GET",
        path: formatSecureRoutePath(
            "/s/{channelSource}/{channelId}/hls/{profile}/{filename}",
            serverConfig,
        ),
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
