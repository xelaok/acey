import fetch from "node-fetch";

type FetchAcePlaylistResult = {
    content: string,
    modified: boolean,
    lastModified: string | null,
};

async function fetchAcePlaylist(playlistUrl: string, ifModifiedSince: string | null): Promise<FetchAcePlaylistResult> {
    const response = await fetch(playlistUrl, {
        compress: true,
        headers: {
            "If-Modified-Since": ifModifiedSince,
        },
    });

    if (response.status === 304) {
        return {
            content: null,
            modified: false,
            lastModified: null,
        };
    }

    const content = await response.text();

    return {
        content,
        modified: true,
        lastModified: response.headers.get("Last-Modified"),
    };
}

export { fetchAcePlaylist }
