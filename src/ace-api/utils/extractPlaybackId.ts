function extractPlaybackId(playbackUrl: string): string {
    const pos2 = playbackUrl.lastIndexOf("/");
    const pos1 = playbackUrl.lastIndexOf("/", pos2 - 1);
    return playbackUrl.substring(pos1 + 1, pos2);
}

export { extractPlaybackId }
