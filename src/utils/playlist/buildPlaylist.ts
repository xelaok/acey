import { sortBy } from "lodash";
import { Channel, ChannelGroup, PlaylistFormatOptions } from "../../types";

function buildPlaylist(
    streamsPath: string,
    channels: Channel[],
    channelGroups: ChannelGroup[],
    formatOptions: PlaylistFormatOptions,
): string {
    let result = "#EXTM3U\n";
    const sortedChannels = sortChannels(channels, channelGroups);

    for (const c of sortedChannels) {
        const groupTitle = c.group ? c.group.title : "";

        result +=`#EXTINF:-1`;

        if (formatOptions.useTvgNameAttr) {
            result += ` tvg-name="${c.name}"`;
        }

        if (formatOptions.useGroupTitleAttr && groupTitle) {
            result += ` group-title="${groupTitle}"`;
        }

        result += `,${c.name}`;

        if (!formatOptions.useExtGrp && !formatOptions.useGroupTitleAttr && groupTitle) {
            result += ` (${groupTitle})`;
        }

        result += `\n`;

        if (formatOptions.useExtGrp && groupTitle) {
            result += `#EXTGRP:${groupTitle}\n`;
        }

        result += `${streamsPath}/${c.id}\n`;
    }

    return result;
}

function sortChannels(
    channels: Channel[],
    channelGroups: ChannelGroup[],
): Channel[] {
    const groupOrderMap = channelGroups.reduce(
        (map, g, idx) => map.set(g, idx),
        new Map<ChannelGroup, number>()
    );

    return sortBy(channels, [
        (c: Channel) => groupOrderMap.get(c.group),
        (c: Channel) => c.name,
    ]);
}

export { buildPlaylist }
