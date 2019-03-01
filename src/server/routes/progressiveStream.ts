import { Request, ResponseToolkit, Server } from "hapi";
import { ChannelRepository } from "../../channel-repository";
import { Progressive } from "../../progressive";
import { parseChannel } from "../utils/parseChannel";

function progressiveStream(
    server: Server,
    channelRepository: ChannelRepository,
    progressiveDownload: Progressive,
): void {
    server.route({
        method: "GET",
        path: "/s/{channelSource}/{channelId}.ts",
        handler: async (request: Request, h: ResponseToolkit) => {
            const channel = parseChannel(request, channelRepository);

            if (!channel) {
                return h.response().code(404);
            }

            return progressiveDownload.handleRequest(request, h, channel);
        },
    });
}

export { progressiveStream }
