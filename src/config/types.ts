import { Dict, LoggerOptions } from "../base";
import { ChannelGroup, ChannelSourceType, StreamProtocol } from "../types";

type RawMainConfig = {
    app: RawAppConfig;
    server: RawServerConfig;
    aceApi: RawAceApiConfig;
    stream: RawStreamConfig;
    ffmpeg: RawFFmpegConfig;
    hls: RawHlsConfig;
    progressive: RawProgressiveConfig;
    logger: RawLoggerConfig;
};

type RawAppConfig = AppConfig;
type RawChannelGroupConfig = ChannelGroup;

type RawServerConfig = {
    binding: string;
    accessToken: string | undefined;
    logRequests: string;
};

type RawAceApiConfig = {
    endpoint: string;
    requestTimeout: string;
};

type RawStreamConfig = {
    stopDelay: string;
    responseTimeout: string;
    sharedBufferLength: string;
};

type RawFFmpegConfig = {
    binPath: string;
    outPath: string;
    logOutput: string;
};

type RawHlsConfig = Dict<RawHlsProfile>;

type RawHlsProfile = {
    idleTimeout: string;
    segmentLength: string;
    minListLength: string;
    maxListLength: string;
    minInitListLength: string;
    minPrebufferLength: string;
    deleteThresholdLength: string;
    ffmpegArgs: string;
};

type RawProgressiveConfig = {
    clientIdleTimeout: string;
    clientMaxBufferLength: string;
    clientResetBufferLength: string;
};

type RawLoggerConfig = {
    level: string;
}

type RawChannelSourceConfig = {
    type: string;
    label: string;
};

type RawAceChannelSourceConfig = RawChannelSourceConfig & {
    url: string;
    updateInterval: string;
};

type RawPlaylistConfig = {
    filter: string | null;
    format: string;
    protocol: string;
    channelSources: string | null;
};

type RawPlaylistFilterConfig = string[];

type RawPlaylistFormatConfig = {
    useExtGrp: string;
    useTvgNameAttr: string;
    useTvgLogoAttr: string;
    useGroupTitleAttr: string;
    includeGroupName: string;
    includeSourceLabel: string;
};

type Config = {
    app: AppConfig;
    server: ServerConfig;
    aceApi: AceApiConfig;
    stream: StreamConfig;
    ffmpeg: FFmpegConfig;
    hls: HlsConfig;
    progressive: ProgressiveConfig;
    logger: LoggerOptions;
    groups: ChannelGroup[];
    groupsMap: Dict<ChannelGroup>;
    channelSources: Dict<ChannelSourceConfig>;
    playlists: Dict<PlaylistConfig>;
};

type AppConfig = {
    dataDirectory: string;
};

type ServerConfig = {
    binding: string;
    accessToken: string;
    logRequests: boolean;
};

type AceApiConfig = {
    endpoint: string;
    requestTimeout: number;
};

type StreamConfig = {
    stopDelay: number;
    responseTimeout: number;
    sharedBufferLength: number;
};

type FFmpegConfig = {
    binPath: string;
    outPath: string;
    logOutput: boolean;
};

type HlsConfig = Dict<HlsProfile>;

type HlsProfile = {
    idleTimeout: number;
    segmentLength: number;
    minListLength: number;
    maxListLength: number;
    minInitListLength: number;
    minPrebufferLength: number;
    deleteThresholdLength: number;
    ffmpegArgs: string;
};

type ProgressiveConfig = {
    clientIdleTimeout: number;
    clientMaxBufferLength: number;
    clientResetBufferLength: number;
};

type ChannelSourceConfig = {
    type: ChannelSourceType;
    label: string;
};

type AceChannelSourceConfig = ChannelSourceConfig & {
    url: string;
    updateInterval: number;
};

type PlaylistConfig = {
    filter: PlaylistFilterConfig;
    format: PlaylistFormatConfig;
    protocol: StreamProtocol;
    protocolProfile: string;
    channelSources: string[];
};

type PlaylistFilterConfig = Set<string> | null;

type PlaylistFormatConfig = {
    useExtGrp: boolean;
    useTvgNameAttr: boolean;
    useTvgLogoAttr: boolean;
    useGroupTitleAttr: boolean;
    includeGroupName: boolean;
    includeSourceLabel: boolean;
};

export {
    RawMainConfig,
    RawAppConfig,
    RawServerConfig,
    RawAceApiConfig,
    RawStreamConfig,
    RawFFmpegConfig,
    RawHlsConfig,
    RawHlsProfile,
    RawProgressiveConfig,
    RawLoggerConfig,
    RawChannelGroupConfig,
    RawChannelSourceConfig,
    RawAceChannelSourceConfig,
    RawPlaylistConfig,
    RawPlaylistFilterConfig,
    RawPlaylistFormatConfig,
    Config,
    AppConfig,
    ServerConfig,
    AceApiConfig,
    StreamConfig,
    FFmpegConfig,
    HlsConfig,
    HlsProfile,
    ProgressiveConfig,
    ChannelSourceConfig,
    AceChannelSourceConfig,
    PlaylistConfig,
    PlaylistFilterConfig,
    PlaylistFormatConfig,
}
