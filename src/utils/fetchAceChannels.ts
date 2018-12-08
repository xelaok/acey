import fetch from "node-fetch";
import { parseAcePlaylist } from "./parseAcePlaylist";
import { AceChannel } from "../types";

async function fetchAceChannels(playlistUrl: string): Promise<AceChannel[]> {
    const response = await fetch(playlistUrl, { compress: true });
    const content = await response.text();
    return parseAcePlaylist(content);
}

export { fetchAceChannels }
