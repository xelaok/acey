import { Server, Request, ResponseToolkit, ResponseObject } from "hapi";
import { Dict, getBaseRequestPath } from "../../base";
import { ServerConfig, PlaylistConfig } from "../../config";
import { ChannelGroup } from "../../types";
import { ChannelSources } from "../../channel-sources";
import { buildPlaylist } from "../../playlist-util";

function playlist(
    server: Server,
    serverConfig: ServerConfig,
    groups: ChannelGroup[],
    playlistConfigs: Dict<PlaylistConfig>,
    channelSources: ChannelSources,
): void {
    server.route({
        method: "GET",
        path: "/{name}.m3u",
        handler: (request: Request, h: ResponseToolkit) => {
            return handle(
                request,
                h,
                false,
                serverConfig,
                groups,
                playlistConfigs,
                channelSources,
            );
        },
    });

    server.route({
        method: "GET",
        path: "/not/{name}.m3u",
        handler: (request: Request, h: ResponseToolkit) => {
            return handle(
                request,
                h,
                true,
                serverConfig,
                groups,
                playlistConfigs,
                channelSources,
            );
        },
    });
}

function handle(
    request: Request,
    h: ResponseToolkit,
    filterNegative: boolean,
    serverConfig: ServerConfig,
    groups: ChannelGroup[],
    playlistConfigs: Dict<PlaylistConfig>,
    channelSources: ChannelSources,
): ResponseObject {
    const { name } = request.params;
    const playlistConfig = playlistConfigs[name];

    if (!playlistConfig) {
        return h.response().code(404);
    }

    const basePath = getBaseRequestPath(request);
    const channels = channelSources.getChannels(playlistConfig.channelSources);

    const content = buildPlaylist(
        basePath,
        channels,
        groups,
        playlistConfig.format,
        playlistConfig.filter,
        playlistConfig.protocol,
        playlistConfig.protocolProfile,
        filterNegative,
    );

    const query = request.query as Dict<string>;
    const asText = "asText" in query;

    return h
        .response(content)
        .code(200)
        .type(asText ? "text/plain" : "audio/x-mpegurl")
        ;
}

export { playlist }
