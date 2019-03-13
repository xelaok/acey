import { Request, ResponseToolkit, Server } from "hapi";
import { ServerConfig } from "../../config";
import { ChannelRepository } from "../../channel-repository";
import { ProgressiveService } from "../../progressive";
import { formatSecureRoutePath } from "../utils/formatSecureRoutePath";
import { parseChannel } from "../utils/parseChannel";

function progressiveStream(
    server: Server,
    serverConfig: ServerConfig,
    channelRepository: ChannelRepository,
    progressiveService: ProgressiveService,
): void {
    server.route({
        method: "GET",
        path: formatSecureRoutePath(
            "/s/{channelSource}/{channelId}.ts",
            serverConfig,
        ),
        handler: async (request: Request, h: ResponseToolkit) => {
            const channel = parseChannel(request, channelRepository);

            if (!channel) {
                return h.response().code(404);
            }

            return progressiveService.handleRequest(request, h, channel);
        },
    });
}

export { progressiveStream }
