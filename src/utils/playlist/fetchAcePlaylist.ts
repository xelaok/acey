import fetch from "node-fetch";

async function fetchAcePlaylist(playlistUrl: string): Promise<string> {
    const response = await fetch(playlistUrl, { compress: true });
    const content = await response.text();
    return content;
}

export { fetchAcePlaylist }
