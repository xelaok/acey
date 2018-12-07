import { ChannelRepository } from "../services/ChannelRepository";
import { fetchTtvChannels } from "./fetchTtvChannels";
import { getChannelsFromTtvChannels } from "./getChannelsFromTtvChannels";

async function loadTtvChannels(
    playlistUrl: string,
    channelsRepository: ChannelRepository
): Promise<void> {
    console.log("Load TTV channels...");
    try {
        const ttvChannels = await fetchTtvChannels(playlistUrl);
        console.log(`Load TTV channels success (${ttvChannels.length} items).`);

        const channels = getChannelsFromTtvChannels(ttvChannels);
        channelsRepository.update(channels);
    }
    catch (error) {
        console.log("Load TTV channels failed.");
        console.error(error);
    }
}

export { loadTtvChannels }
