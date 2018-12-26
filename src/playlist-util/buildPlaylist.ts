import { sortBy } from "lodash";
import { CRLF } from "../base";
import { StreamGroup, StreamType, ClientStreamInfo } from "../types";
import { PlaylistFormatConfig, PlaylistFilterConfig } from "../config";

function buildPlaylist(
    streamPath: string,
    streamInfos: ClientStreamInfo[],
    groups: StreamGroup[],
    playlistFormat: PlaylistFormatConfig,
    filter: PlaylistFilterConfig | null,
    filterNegative: boolean,
): string {
    let resultStreamInfos = streamInfos;
    resultStreamInfos = sortStreams(resultStreamInfos, groups);
    resultStreamInfos = filterStreams(resultStreamInfos, filter, filterNegative);

    let result = "#EXTM3U" + CRLF;

    for (const si of resultStreamInfos) {
        const groupTitle = si.stream.group ? si.stream.group.title : "";

        result +=`#EXTINF:-1`;

        if (playlistFormat.useTvgNameAttr) {
            result += ` tvg-name="${si.stream.name}"`;
        }

        if (playlistFormat.useTvgLogoAttr && si.stream.logoUrl) {
            result += ` tvg-logo="${si.stream.logoUrl}"`;
        }

        if (playlistFormat.useGroupTitleAttr && groupTitle) {
            result += ` group-title="${groupTitle}"`;
        }

        result += `,${si.stream.name}`;

        if (playlistFormat.includeGroupName && groupTitle) {
            result += ` (${groupTitle})`;
        }

        if (playlistFormat.includeSourceLabel) {
            result += ` | ${si.sourceLabel}`;
        }

        result += CRLF;

        if (playlistFormat.useExtGrp && groupTitle) {
            result += `#EXTGRP:${groupTitle}${CRLF}`;
        }

        result += `${streamPath}/${getStreamTypePath(si)}/${si.stream.id}.mp4${CRLF}`;
    }

    return result;
}

function sortStreams(
    streamInfos: ClientStreamInfo[],
    groups: StreamGroup[]
): ClientStreamInfo[] {
    const groupIndexMap = groups.reduce(
        (map, g, idx) => map.set(g.name, idx),
        new Map<string, number>()
    );

    const otherGroupIndex = groups.length;

    return sortBy(streamInfos, [
        (info: ClientStreamInfo) => info.stream.group ? groupIndexMap.get(info.stream.group.name) : otherGroupIndex,
        (info: ClientStreamInfo) => info.stream.name.toLowerCase(),
    ]);
}

function filterStreams(
    streamInfos: ClientStreamInfo[],
    filter: PlaylistFilterConfig | null,
    filterNegative: boolean,
) {
    if (filter) {
        return streamInfos.filter(si =>
            filter.has(si.stream.name.toLowerCase()) === !filterNegative
        );
    }
    else {
        return streamInfos;
    }
}

function getStreamTypePath(streamInfo: ClientStreamInfo): string {
    switch (streamInfo.streamType) {
        case StreamType.Ace:
            return "ace";
        case StreamType.Ttv:
            return "ttv";
        default:
            throw new Error(`Unknown stream type: "${streamInfo.streamType}"`);
    }
}

export { buildPlaylist }
