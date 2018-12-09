import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { LoggerOptions } from "../libs/logger";

import {
    ChannelGroup,
    ChannelGroupsParseMap,
    PlaylistFetcherOptions,
    PlaylistFormatOptions,
    StreamProviderOptions
} from "../types";

type Main = {
    server: {
        host: string,
        port: number,
        publicPath: string,
    },
    iproxy: {
        path: string,
    },
    stream: StreamProviderOptions,
    playlistFormat: PlaylistFormatOptions,
    playlistFetcher: PlaylistFetcherOptions,
    logger: LoggerOptions,
};

type Config = Main & {
    channelGroups: ChannelGroup[],
    channelGroupsParseMap: ChannelGroupsParseMap,
};

const basePath = path.resolve(__dirname, "../../config");
const playlistsBasePath = path.resolve(basePath, "playlists");

function getConfig(): Config {
    const main: Main = yaml.safeLoad(
        fs.readFileSync(path.resolve(basePath, "main.yaml"), "utf8")
    );

    const channelGroups: ChannelGroup[] = yaml.safeLoad(
        fs.readFileSync(path.resolve(basePath, "channel-groups.yaml"), "utf8")
    );

    const channelGroupsMap = channelGroups.reduce((map, g) => map.set(g.name, g), new Map());

    const channelGroupsParseMapRaw: { [key: string]: string } = yaml.safeLoad(
        fs.readFileSync(path.resolve(basePath, "channel-groups-parse-map.yaml"), "utf8")
    );

    const channelGroupsParseMap = new Map<string, ChannelGroup>();

    for (const key in channelGroupsParseMapRaw) {
        const name = channelGroupsParseMapRaw[key];
        const group = channelGroupsMap.get(name);

        if (!group) {
            continue;
        }

        channelGroupsParseMap.set(key, group);
    }

    return {
        ...main,
        channelGroups,
        channelGroupsParseMap,
    };
}

function getPlaylistConfig(name: string): Set<string> | null {
    const filename = path.resolve(playlistsBasePath, name + ".yaml");

    if (!fs.existsSync(filename)) {
        return null;
    }

    const list: string[] = yaml.safeLoad(fs.readFileSync(filename, "utf8"));
    return new Set(list.map(name => name.toLowerCase()));
}

export { getConfig, getPlaylistConfig }
