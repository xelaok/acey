import { ChannelsRepository } from "../services/ChannelsRepository";
import { sortChannels } from "./sortChannels";
import { buildPlaylist } from "./buildPlaylist";

function buildFullPlaylist(streamsPath: string, channelsRepository: ChannelsRepository) {
    const channels = Array.from(channelsRepository.items());
    const sortedChannels = sortChannels(channels);
    return buildPlaylist(streamsPath, sortedChannels);
}

export { buildFullPlaylist }
