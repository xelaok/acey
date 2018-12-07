import { ChannelRepository } from "../services/ChannelRepository";
import { sortChannels } from "./sortChannels";
import { buildPlaylist } from "./buildPlaylist";

function buildFullPlaylist(streamsPath: string, channelRepository: ChannelRepository) {
    const channels = Array.from(channelRepository.all());

    const sortedChannels = sortChannels(channels);
    return buildPlaylist(streamsPath, sortedChannels);
}

export { buildFullPlaylist }
