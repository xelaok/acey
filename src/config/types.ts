import { Dict } from "../base";
import { ChannelGroup, ChannelSource, StreamProtocol } from "../types";

type RawMainConfig = {
    app: RawAppConfig;
    server: RawServerConfig;
    aceApi: RawAceApiConfig;
    ttvApi: RawTtvApiConfig;
    stream: RawStreamConfig;
    ffmpeg: RawFFmpegConfig;
    hls: RawHlsConfig;
    progressive: RawProgressiveConfig;
    logger: RawLoginConfig;
};

type RawAppConfig = AppConfig;
type RawAceApiConfig = AceApiConfig;
type RawTtvApiConfig = TtvApiConfig;
type RawLoginConfig = LoggerConfig;
type RawChannelGroupConfig = ChannelGroup;

type RawServerConfig = {
    binding: string;
    accessToken: string | undefined;
    logRequests: string;
};

type RawStreamConfig = {
    stopDelay: string;
    sharedBufferLength: string;
    requestTimeout: string;
    responseTimeout: string;
};

type RawFFmpegConfig = {
    binPath: string;
    outPath: string;
    logOutput: string;
};

type RawHlsConfig = Dict<RawHlsProfile>;

type RawHlsProfile = {
    idleTimeout: string;
    requestTimeout: string;
    segmentLength: string;
    minListLength: string;
    maxListLength: string;
    minPrebufferLength: string;
    deleteThresholdLength: string;
    ffmpegArgs: string;
};

type RawProgressiveConfig = {
    clientIdleTimeout: string;
    clientMaxBufferLength: string;
    clientResetBufferLength: string;
};

type RawChannelSourceConfig = {
    provider: string;
    label: string;
};

type RawAceUrlChannelSourceConfig = RawChannelSourceConfig & {
    url: string;
    updateInterval: string;
};

type RawTtvApiChannelSourceConfig = RawChannelSourceConfig & {
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
    ttvApi: TtvApiConfig;
    stream: StreamConfig;
    ffmpeg: FFmpegConfig;
    hls: HlsConfig;
    progressive: ProgressiveConfig;
    logger: LoggerConfig;
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
};

type StreamConfig = {
    stopDelay: number;
    sharedBufferLength: number;
    requestTimeout: number;
    responseTimeout: number;
};

type FFmpegConfig = {
    binPath: string;
    outPath: string;
    logOutput: boolean;
};

type HlsConfig = Dict<HlsProfile>;

type HlsProfile = {
    idleTimeout: number;
    requestTimeout: number;
    segmentLength: number;
    minListLength: number;
    maxListLength: number;
    minPrebufferLength: number;
    deleteThresholdLength: number;
    ffmpegArgs: string;
};

type ProgressiveConfig = {
    clientIdleTimeout: number;
    clientMaxBufferLength: number;
    clientResetBufferLength: number;
};

type TtvApiConfig = {
    username: string;
    password: string;
    endpoint: string;
};

type LoggerConfig = {
    level: string;
};

type ChannelSourceConfig = {
    provider: ChannelSource;
    label: string;
};

type AceUrlChannelSourceConfig = ChannelSourceConfig & {
    url: string;
    updateInterval: number;
};

type TtvApiChannelSourceConfig = ChannelSourceConfig & {
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
    RawTtvApiConfig,
    RawLoginConfig,
    RawChannelGroupConfig,
    RawChannelSourceConfig,
    RawAceUrlChannelSourceConfig,
    RawTtvApiChannelSourceConfig,
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
    TtvApiConfig,
    LoggerConfig,
    ChannelSourceConfig,
    AceUrlChannelSourceConfig,
    TtvApiChannelSourceConfig,
    PlaylistConfig,
    PlaylistFilterConfig,
    PlaylistFormatConfig,
}
