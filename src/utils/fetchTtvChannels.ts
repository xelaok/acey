import fetch from "node-fetch";
import { parseTtvPlaylist } from "./parseTtvPlaylist";
import { TtvChannel } from "../types";

async function fetchTtvChannels(playlistUrl: string): Promise<TtvChannel[]> {
    const response = await fetch(playlistUrl, { compress: true });
    const content = await response.text();
    return parseTtvPlaylist(content);
}

export { fetchTtvChannels }
