import { Server, Request, ResponseToolkit, ResponseObject } from "hapi";
import { Dict } from "../../base";
import { ServerConfig, PlaylistConfig } from "../../config";
import { StreamGroup } from "../../types";
import { Sources } from "../../sources";
import { buildPlaylist } from "../../playlist-util";

function handleGetPlaylist(
    server: Server,
    serverConfig: ServerConfig,
    groups: StreamGroup[],
    playlistConfigs: Dict<PlaylistConfig>,
    sources: Sources,
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
                sources,
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
                sources,
            );
        },
    });
}

function handle(
    request: Request,
    h: ResponseToolkit,
    filterNegative: boolean,
    serverConfig: ServerConfig,
    groups: StreamGroup[],
    playlistConfigs: Dict<PlaylistConfig>,
    sources: Sources,
): ResponseObject {
    const { name } = request.params;
    const playlistConfig = playlistConfigs[name];

    if (!playlistConfig) {
        return h.response().code(404);
    }

    const streamPath = `${serverConfig.publicPath}/s`;
    const streamInfos = sources.getStreamInfos(playlistConfig.sources);

    const content = buildPlaylist(
        streamPath,
        streamInfos,
        groups,
        playlistConfig.format,
        playlistConfig.filter,
        filterNegative,
    );

    return h.response(content).code(200);
}

export { handleGetPlaylist }
