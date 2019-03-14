import { sortBy } from "lodash";
import urlJoin from "url-join";
import { CRLF } from "../../base";
import { ChannelGroup, ChannelSource, StreamProtocol } from "../../types";
import { PlaylistFilterConfig, PlaylistFormatConfig } from "../../config";
import { ChannelSourceInfo } from "../../channel-sources";
import { HLS_PLAYLIST_NAME } from "../../hls";

function buildPlaylist(
    basePath: string,
    channelSourceInfos: ChannelSourceInfo[],
    groups: ChannelGroup[],
    playlistFormat: PlaylistFormatConfig,
    filter: PlaylistFilterConfig | null,
    streamProtocol: StreamProtocol,
    streamProtoProfile: string,
    filterNegative: boolean,
): string {
    let resultChannelSourceInfos = channelSourceInfos;
    resultChannelSourceInfos = filterChannels(resultChannelSourceInfos, filter, filterNegative);
    resultChannelSourceInfos = sortChannels(resultChannelSourceInfos, groups);

    let result = "#EXTM3U" + CRLF + CRLF;

    for (const si of resultChannelSourceInfos) {
        const groupTitle = si.channel.group ? si.channel.group.title : "";

        result +=`#EXTINF:-1`;

        if (playlistFormat.useTvgNameAttr) {
            result += ` tvg-name="${si.channel.name}"`;
        }

        if (playlistFormat.useTvgLogoAttr && si.channel.logoUrl) {
            result += ` tvg-logo="${si.channel.logoUrl}"`;
        }

        if (playlistFormat.useGroupTitleAttr && groupTitle) {
            result += ` group-title="${groupTitle}"`;
        }

        result += `,${si.channel.name}`;

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

        switch (streamProtocol) {
            case StreamProtocol.Progressive:
                result += urlJoin(basePath, `s/${getStreamTypePath(si)}/${si.channel.id}.ts`);
                break;
            case StreamProtocol.Hls:
                result += urlJoin(basePath, `s/${getStreamTypePath(si)}/${si.channel.id}/hls/${streamProtoProfile}/${HLS_PLAYLIST_NAME}`);
                break;
            default:
                throw new Error(`Unknown stream protocol: ${streamProtocol}`);
        }

        result += CRLF + CRLF;
    }

    return result;
}

function filterChannels(
    channelSourceInfos: ChannelSourceInfo[],
    filter: PlaylistFilterConfig | null,
    filterNegative: boolean,
) {
    if (filter) {
        return channelSourceInfos.filter(csi =>
            filter.has(csi.channel.name.toLowerCase()) === !filterNegative
        );
    }
    else {
        return channelSourceInfos;
    }
}

function sortChannels(
    channelSourceInfos: ChannelSourceInfo[],
    channelGroups: ChannelGroup[]
): ChannelSourceInfo[] {
    const groupIndexMap = channelGroups.reduce(
        (map, g, idx) => map.set(g.name, idx),
        new Map<string, number>()
    );

    const otherGroupIndex = channelGroups.length;

    return sortBy(channelSourceInfos, [
        (csi: ChannelSourceInfo) => csi.channel.group ? groupIndexMap.get(csi.channel.group.name) : otherGroupIndex,
        (csi: ChannelSourceInfo) => csi.channel.name.toLowerCase(),
    ]);
}

function getStreamTypePath(channelSourceInfo: ChannelSourceInfo): string {
    switch (channelSourceInfo.channel.source) {
        case ChannelSource.Ace:
            return "ace";
        case ChannelSource.Ttv:
            return "ttv";
        default:
            throw new Error(`Unknown channel source: ${channelSourceInfo.channel.source}`);
    }
}

export { buildPlaylist }
