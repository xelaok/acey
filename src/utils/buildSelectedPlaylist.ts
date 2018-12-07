import { ChannelsRepository } from "../services/ChannelsRepository";
import { sortChannels } from "./sortChannels";
import { buildPlaylist } from "./buildPlaylist";

function buildSelectedPlaylist(streamsPath: string, selectedChannelsSet: Set<string>, channelsRepository: ChannelsRepository) {
    const channels = Array.from(channelsRepository.items());
    const selectedChannels = channels.filter(c => selectedChannelsSet.has(c.name));
    const sortedChannels = sortChannels(selectedChannels);
    return buildPlaylist(streamsPath, sortedChannels);
}

export { buildSelectedPlaylist }
