type HlsPlaylist = {
    tags: HlsPlaylistTag[];
    segments: HlsPlaylistSegment[];
};

type HlsPlaylistTag = {
    name: string;
    value: string;
};

type HlsPlaylistSegment = {
    name: string;
    length: number;
};

export { HlsPlaylist, HlsPlaylistTag, HlsPlaylistSegment }
