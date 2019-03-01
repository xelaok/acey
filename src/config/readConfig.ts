import os from "os";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { reduce } from "lodash";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

import {
    AceUrlChannelSourceConfig,
    Config,
    FFmpegConfig,
    HlsConfig,
    HlsProfile,
    PlaylistConfig,
    PlaylistFilterConfig,
    PlaylistFormatConfig,
    ProgressiveDownloadConfig,
    RawAceUrlChannelSourceConfig,
    RawFFmpegConfig,
    RawChannelGroupConfig,
    RawHlsConfig,
    RawHlsProfile,
    RawMainConfig,
    RawPlaylistConfig,
    RawPlaylistFilterConfig,
    RawPlaylistFormatConfig,
    RawProgressiveDownloadConfig,
    RawServerConfig,
    RawChannelSourceConfig,
    RawStreamConfig,
    RawTtvApiChannelSourceConfig,
    ServerConfig,
    ChannelSourceConfig,
    StreamConfig,
    TtvApiChannelSourceConfig,
} from "./types";

import { Dict, parseBoolean, parseDuration } from "../base";
import { ChannelGroup, ChannelSource, StreamProtocol } from "../types";

const basePath = path.resolve(__dirname, "../../config");
const mainPath = path.join(basePath, "main.yaml");
const playlistsPath = path.join(basePath, "playlists");
const playlistFiltersPath = path.join(basePath, "playlist-filters");
const playlistFormatsPath = path.join(basePath, "playlist-formats");
const channelSourcesPath = path.join(basePath, "channel-sources");
const channelGroupsPath = path.join(basePath, "channel-groups.yaml");
const channelGroupsMapPath = path.join(basePath, "channel-groups-map.yaml");

async function readConfig(): Promise<Config> {
    const rawConfig$ = readConfigFile<RawMainConfig>(mainPath);
    const groups$ = readChannelGroups();
    const channelSources$ = readChannelSources();
    const playlists$ = readPlaylists();

    const groupsMap$ = groups$.then(
        channelGroups => readChannelGroupsMap(channelGroups)
    );

    const [
        rawConfig,
        groups,
        groupsMap,
        channelSources,
        playlists,
    ] = await Promise.all([
        rawConfig$,
        groups$,
        groupsMap$,
        channelSources$,
        playlists$,
    ]);

    return {
        app: rawConfig.app,
        server: parseServerConfig(rawConfig.server),
        aceApi: rawConfig.aceApi,
        stream: parseStreamConfig(rawConfig.stream),
        ffmpeg: parseFfmpegConfig(rawConfig.ffmpeg),
        hls: parseHlsConfig(rawConfig.hls),
        progressiveDownload: parseProgressiveDownloadConfig(rawConfig.progressiveDownload),
        ttvApi: rawConfig.ttvApi,
        logger: rawConfig.logger,
        groups,
        groupsMap,
        channelSources,
        playlists,
    };
}

async function readChannelGroups(): Promise<ChannelGroup[]> {
    return await readConfigFile<RawChannelGroupConfig[]>(channelGroupsPath);
}

async function readChannelGroupsMap(groups: ChannelGroup[]): Promise<Dict<ChannelGroup>> {
    const rawDict = await readConfigFile<Dict<string>>(channelGroupsMapPath);
    const namesMap = groups.reduce((map, g) => map.set(g.name, g), new Map());

    return reduce(
        rawDict,
        (result, name, key) => {
            result[key] = namesMap.get(name);
            return result;
        },
        {} as Dict<ChannelGroup>);
}

async function readChannelSources(): Promise<Dict<ChannelSourceConfig>> {
    const rawConfigs = await readConfigDirectory<RawChannelSourceConfig>(channelSourcesPath);

    return reduce(
        rawConfigs,
        (result, raw, key) => {
            switch (raw.provider) {
                case "ace-url":
                    result[key] = parseAceUrlChannelSourceConfig(raw as RawAceUrlChannelSourceConfig);
                    break;
                case "ttv-api":
                    result[key] = parseTtvChannelSourceConfig(raw as RawTtvApiChannelSourceConfig);
                    break;
                default:
                    throw new Error(`Unknown channel source provider: "${raw.provider}"`);
            }
            return result;
        },
        {} as Dict<ChannelSourceConfig>,
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

    return reduce(
        rawConfigs,
        (result, raw, key) => {
            result[key] = {
                filter: (raw.filter && filters[raw.filter]) || null,
                format: formats[raw.format] || null,
                channelSources: raw.channelSources ? raw.channelSources.split(",").map(s => s.trim()) : [],
                ...parseStreamProtocol(raw.protocol || ""),
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

function parseServerConfig(raw: RawServerConfig): ServerConfig {
    return {
        ...raw,
        accessToken: raw.accessToken || "",
        logRequests: parseBoolean(raw.logRequests),
    };
}

function parseStreamConfig(raw: RawStreamConfig): StreamConfig {
    return {
        ...raw,
        stopDelay: parseDuration(raw.stopDelay),
        sharedBufferLength: parseDuration(raw.sharedBufferLength),
        requestTimeout: parseDuration(raw.requestTimeout),
        responseTimeout: parseDuration(raw.responseTimeout),
    };
}

function parseFfmpegConfig(raw: RawFFmpegConfig): FFmpegConfig {
    return {
        ...raw,
        binPath: raw.binPath || ffmpeg.path,
        outPath: raw.outPath || os.tmpdir(),
        logOutput: parseBoolean(raw.logOutput),
    };
}

function parseHlsConfig(raw: RawHlsConfig): HlsConfig {
    const result: HlsConfig = {};

    for (const name in raw) {
        result[name] = parseHlsProfile(raw[name]);
    }

    return result;
}

function parseHlsProfile(raw: RawHlsProfile): HlsProfile {
    return {
        ...raw,
        idleTimeout: parseDuration(raw.idleTimeout),
        requestTimeout: parseDuration(raw.requestTimeout),
        segmentLength: parseDuration(raw.segmentLength),
        maxIndexLength: parseDuration(raw.maxIndexLength),
        minIndexLength: parseDuration(raw.minIndexLength),
        deleteThresholdLength: parseDuration(raw.deleteThresholdLength),
        ffmpegArgs: raw.ffmpegArgs.trim(),
    };
}

function parseProgressiveDownloadConfig(raw: RawProgressiveDownloadConfig): ProgressiveDownloadConfig {
    return {
        ...raw,
        clientIdleTimeout: parseDuration(raw.clientIdleTimeout),
        clientMaxBufferLength: parseDuration(raw.clientMaxBufferLength),
        clientResetBufferLength: parseDuration(raw.clientResetBufferLength),
    };
}

function parseAceUrlChannelSourceConfig(raw: RawAceUrlChannelSourceConfig): AceUrlChannelSourceConfig {
    return {
        provider: ChannelSource.Ace,
        label: raw.label,
        url: raw.url,
        updateInterval: parseDuration(raw.updateInterval),
    };
}

function parseTtvChannelSourceConfig(raw: RawTtvApiChannelSourceConfig): TtvApiChannelSourceConfig {
    return {
        provider: ChannelSource.Ttv,
        label: raw.label,
        updateInterval: parseDuration(raw.updateInterval),
    };
}

function parseStreamProtocol(
    raw: string,
): {
    protocol: StreamProtocol,
    protocolProfile: string,
} {
    const [name, profile] = raw.split("/");

    return {
        protocol: parseStreamProto(name),
        protocolProfile: profile || "",
    };
}

function parseStreamProto(raw: string): StreamProtocol {
    switch (raw) {
        case "":
        case "progressive":
            return StreamProtocol.Progressive;
        case "hls":
            return StreamProtocol.Hls;
        default:
            throw new Error(`Can't parse stream protocol: ${raw}`);
    }
}

export {
    readConfig,
}
