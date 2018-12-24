import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import _ from "lodash";

import {
    AceUrlSourceConfig,
    Config,
    PlaylistConfig,
    PlaylistFilterConfig,
    PlaylistFormatConfig,
    RawAceUrlSourceConfig,
    RawGroupConfig,
    RawMainConfig,
    RawPlaylistConfig,
    RawPlaylistFilterConfig,
    RawPlaylistFormatConfig,
    RawSourceConfig,
    RawStreamConfig,
    RawTtvApiSourceConfig,
    SourceConfig,
    StreamConfig,
    TtvApiSourceConfig,
} from "./types";

import { Dict, parseDuration, parseBoolean } from "../base";
import { StreamGroup, StreamSourceType } from "../types";

const basePath = path.resolve(__dirname, "../../config");
const mainPath = path.join(basePath, "main.yaml");
const groupsPath = path.join(basePath, "groups.yaml");
const groupsMapPath = path.join(basePath, "groups-map.yaml");
const playlistsPath = path.join(basePath, "playlists");
const playlistFiltersPath = path.join(basePath, "playlist-filters");
const playlistFormatsPath = path.join(basePath, "playlist-formats");
const sourcesPath = path.join(basePath, "sources");

async function readConfig(): Promise<Config> {
    const rawMainConfig$ = readConfigFile<RawMainConfig>(mainPath);
    const groups$ = readGroups();
    const sources$ = readSources();
    const playlists$ = readPlaylists();

    const groupsMap$ = groups$.then(
        channelGroups => readGroupsMap(channelGroups)
    );

    const [
        rawMainConfig,
        groups,
        groupsMap,
        sources,
        playlists,
    ] = await Promise.all([
        rawMainConfig$,
        groups$,
        groupsMap$,
        sources$,
        playlists$,
    ]);

    return {
        app: rawMainConfig.app,
        server: rawMainConfig.server,
        aceEngine: rawMainConfig.aceEngine,
        stream: parseStreamConfig(rawMainConfig.stream),
        ttvApi: rawMainConfig.ttvApi,
        logger: rawMainConfig.logger,
        groups,
        groupsMap,
        sources,
        playlists,
    };
}

async function readGroups(): Promise<StreamGroup[]> {
    const rawItems = await readConfigFile<RawGroupConfig[]>(groupsPath);
    return rawItems;
}

async function readGroupsMap(groups: StreamGroup[]): Promise<Dict<StreamGroup>> {
    const rawDict = await readConfigFile<Dict<string>>(groupsMapPath);
    const namesMap = groups.reduce((map, g) => map.set(g.name, g), new Map());

    return _.reduce(
        rawDict,
        (result, name, key) => {
            result[key] = namesMap.get(name);
            return result;
        },
        {} as Dict<StreamGroup>);
}

async function readSources(): Promise<Dict<SourceConfig>> {
    const rawConfigs = await readConfigDirectory<RawSourceConfig>(sourcesPath);

    return _.reduce(
        rawConfigs,
        (result, raw, key) => {
            switch (raw.provider) {
                case "ace-url":
                    result[key] = parseAceUrlSourceConfig(raw as RawAceUrlSourceConfig);
                    break;
                case "ttv-api":
                    result[key] = parseTtvChannelSourceConfig(raw as RawTtvApiSourceConfig);
                    break;
                default:
                    throw new Error(`Unknown source provider: "${raw.provider}"`);
            }
            return result;
        },
        {} as Dict<SourceConfig>,
    );
}

async function readPlaylists(): Promise<Dict<PlaylistConfig>> {
    const [
        rawConfigs,
        filters,
        formats,
    ] = await Promise.all([
        readConfigDirectory<RawPlaylistConfig>(playlistsPath),
        readPlaylistFilters(),
        readPlaylistFormats(),
    ]);

    return _.reduce(
        rawConfigs,
        (result, raw, key) => {
            result[key] = {
                filter: (raw.filter && filters[raw.filter]) || null,
                format: formats[raw.format] || null,
                sources: raw.sources ? raw.sources.split(",").map(s => s.trim()) : [],
            };

            return result;
        },
        {} as Dict<PlaylistConfig>,
    );
}

async function readPlaylistFilters(): Promise<Dict<PlaylistFilterConfig>> {
    const rawConfigs = await readConfigDirectory<RawPlaylistFilterConfig>(playlistFiltersPath);

    const result: Dict<PlaylistFilterConfig> = {};

    for (const name of Object.getOwnPropertyNames(rawConfigs)) {
        result[name] = rawConfigs[name]
            ? new Set(rawConfigs[name].map(value => value.toLowerCase()))
            : null
        ;
    }

    return result;
}

async function readPlaylistFormats(): Promise<Dict<PlaylistFormatConfig>> {
    const rawConfigs = await readConfigDirectory<RawPlaylistFormatConfig>(playlistFormatsPath);

    const result: Dict<PlaylistFormatConfig> = {};

    for (const name of Object.getOwnPropertyNames(rawConfigs)) {
        const raw = rawConfigs[name];

        result[name] = {
            useExtGrp: parseBoolean(raw.useExtGrp),
            useTvgNameAttr: parseBoolean(raw.useTvgNameAttr),
            useTvgLogoAttr: parseBoolean(raw.useTvgLogoAttr),
            useGroupTitleAttr: parseBoolean(raw.useGroupTitleAttr),
            includeGroupName: parseBoolean(raw.includeGroupName),
            includeSourceLabel: parseBoolean(raw.includeSourceLabel),
        };
    }

    return result;
}

async function readConfigDirectory<T>(dir: string): Promise<Dict<T>> {
    const filenames = await readDir(dir);

    const configs = await Promise.all(filenames.map(fn =>
        readConfigFile<T>(path.join(dir, fn))
    ));

    return filenames.reduce((result, fn, index) => {
        result[path.parse(fn).name] = configs[index];
        return result;
    }, {} as Dict<T>);
}

async function readConfigFile<T>(filename: string): Promise<T> {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, "utf8", (err, result) => {
           if (err) {
               reject(err);
               return;
           }

           resolve(yaml.safeLoad(result));
        });
    });
}

async function readDir(path: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
       fs.readdir(path, (err, files) => {
          if (err) {
              reject(err);
              return;
          }

          resolve(files);
       });
    });
}

function parseStreamConfig(raw: RawStreamConfig): StreamConfig {
    return {
        ...raw,
        requestTimeout: parseDuration(raw.requestTimeout),
        stopDelay: parseDuration(raw.stopDelay),
        sharedBufferLength: parseDuration(raw.sharedBufferLength),
        clientIdleTimeout: parseDuration(raw.clientIdleTimeout),
        clientMaxBufferLength: parseDuration(raw.clientMaxBufferLength),
        clientResetBufferLength: parseDuration(raw.clientResetBufferLength),
        chunkedTransferEncoding: parseBoolean(raw.chunkedTransferEncoding),
    };
}

function parseAceUrlSourceConfig(raw: RawAceUrlSourceConfig): AceUrlSourceConfig {
    return {
        provider: StreamSourceType.Ace,
        label: raw.label,
        url: raw.url,
        updateInterval: parseDuration(raw.updateInterval),
    };
}

function parseTtvChannelSourceConfig(raw: RawTtvApiSourceConfig): TtvApiSourceConfig {
    return {
        provider: StreamSourceType.Ttv,
        label: raw.label,
        updateInterval: parseDuration(raw.updateInterval),
    };
}

export {
    readConfig,
}
