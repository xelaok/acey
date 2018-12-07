import { ChannelRepository } from "../services/ChannelRepository";
import { sortChannels } from "./sortChannels";
import { buildPlaylist } from "./buildPlaylist";

function buildSelectedPlaylist(streamsPath: string, selectedChannelsSet: Set<string>, channelRepository: ChannelRepository) {
    const channels = Array.from(channelRepository.all());
    const selectedChannels = channels.filter(c => selectedChannelsSet.has(c.name));
    const sortedChannels = sortChannels(selectedChannels);
    return buildPlaylist(streamsPath, sortedChannels);
}

export { buildSelectedPlaylist }
