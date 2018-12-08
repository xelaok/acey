import { ChannelRepository } from "../services/ChannelRepository";
import { fetchAceChannels } from "./fetchAceChannels";
import { getChannelsFromAceChannels } from "./getChannelsFromAceChannels";

async function loadAceChannels(
    playlistUrl: string,
    channelsRepository: ChannelRepository
): Promise<void> {
    console.log("Load Ace channels...");
    try {
        const ttvChannels = await fetchAceChannels(playlistUrl);
        console.log(`Load Ace channels success (${ttvChannels.length} items).`);

        const channels = getChannelsFromAceChannels(ttvChannels);
        channelsRepository.update(channels);
    }
    catch (error) {
        console.log("Load Ace channels failed.");
        console.error(error);
    }
}

export { loadAceChannels }
