import { ChannelsRepository } from "../services/ChannelsRepository";
import { fetchTtvChannels } from "./fetchTtvChannels";
import { getChannelsFromTtvChannels } from "./getChannelsFromTtvChannels";

async function loadTtvChannels(
    playlistUrl: string,
    channelsRepository: ChannelsRepository
): Promise<void> {
    console.log("Load TTV channels...");
    try {
        const ttvChannels = await fetchTtvChannels(playlistUrl);
        console.log(`Load TTV channels success (${ttvChannels.length} items).`);

        const channels = getChannelsFromTtvChannels(ttvChannels);
        channelsRepository.update(channels, false, true);
    }
    catch (error) {
        console.log("Load TTV channels failed.");
        console.error(error);
    }
}

export { loadTtvChannels }
