function parseInfohash(playbackUrl: string): string {
    const pos2 = playbackUrl.lastIndexOf("/");
    const pos1 = playbackUrl.lastIndexOf("/", pos2 - 1) + 1;
    return playbackUrl.substring(pos1, pos2);
}

export { parseInfohash }
