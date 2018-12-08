import { buildPlaylist } from "./buildPlaylist";
import { Channel } from "../../types";

function buildSelectedPlaylist(streamsPath: string, channels: Channel[], selectedChannelsSet: Set<string>) {
    const selectedChannels = channels.filter(
        c => selectedChannelsSet.has(c.name)
    );
    return buildPlaylist(streamsPath, selectedChannels);
}

export { buildSelectedPlaylist }
