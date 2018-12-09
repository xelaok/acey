import { Server, Request, ResponseToolkit } from "hapi";
import { getPlaylistConfig } from "../config";
import { ChannelRepository } from "../services/ChannelRepository";
import { buildPlaylist } from "../utils/playlist/buildPlaylist";
import { Channel, ChannelGroup, PlaylistFormatOptions } from "../types";

function handleGetPlaylist(
    server: Server,
    publicPath: string,
    playlistFormatOptions: PlaylistFormatOptions,
    channelGroups: ChannelGroup[],
    channelRepository: ChannelRepository,
): void {
    server.route({
        method: "GET",
        path: "/{name}.m3u",
        handler: (request: Request, h: ResponseToolkit) => {
            const { name } = request.params;
            let channels: Channel[];

            if (name !== "all") {
                const playlist = getPlaylistConfig(name);

                if (!playlist) {
                    return h.response().code(404);
                }

                channels = channelRepository.getAll().filter(c => playlist.has(c.name.toLowerCase()));
            }
            else {
                channels = channelRepository.getAll();
            }

            const streamsPath = `${publicPath}/c`;

            const content = buildPlaylist(
                streamsPath,
                channels,
                channelGroups,
                playlistFormatOptions
            );

            return h
                .response(content)
                .header("content-type", "text/plain; charset=utf-8")
                ;
        },
    });
}

export { handleGetPlaylist }
