import { Request, ResponseToolkit, Server } from "hapi";
import { logger } from "../../base";
import { ServerConfig } from "../../config";
import { ChannelRepository } from "../../channel-repository";
import { HlsService } from "../../hls";
import { formatSecureRoutePath } from "../utils/formatSecureRoutePath";
import { parseChannel } from "../utils/parseChannel";

function hlsStream(
    server: Server,
    serverConfig: ServerConfig,
    channelRepository: ChannelRepository,
    hlsService: HlsService,
): void {
    server.route({
        method: "GET",
        path: formatSecureRoutePath(
            "/s/{channelSource}/{channelId}/hls/{profile}/{filename}",
            serverConfig,
        ),
        handler: async (request: Request, h: ResponseToolkit) => {
            try {
                const channel = parseChannel(request, channelRepository);

                if (!channel) {
                    return h.response().code(404);
                }

                const response = await hlsService.handleRequest(
                    request,
                    h,
                    channel,
                    request.params.profile,
                    request.params.filename,
                );

                return response;
            }
            catch (err) {
                logger.error(err instanceof Error ? err.stack : err);
                return h.response().code(500);
            }
        },
    });
}

export { hlsStream }
