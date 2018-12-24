import { Dict } from "../base";
import { StreamGroup, StreamSourceType } from "../types";

type RawMainConfig = {
    app: RawAppConfig,
    server: RawServerConfig,
    aceEngine: RawAceEngineConfig,
    stream: RawStreamConfig,
    ttvApi: RawTtvApiConfig,
    logger: RawLoginConfig,
}

type RawAppConfig = AppConfig;
type RawServerConfig = ServerConfig;
type RawAceEngineConfig = AceEngineConfig;
type RawTtvApiConfig = TtvApiConfig;
type RawLoginConfig = LoggerConfig;
type RawGroupConfig = StreamGroup;

type RawStreamConfig = {
    requestTimeout: string,
    stopDelay: string,
    clientIdleTimeout: string,
    clientMaxBufferLength: string,
    clientResetBufferLength: string,
    sharedBufferLength: string,
    chunkedTransferEncoding: string,
}

type RawSourceConfig = {
    provider: string,
    label: string,
};

type RawAceUrlSourceConfig = RawSourceConfig & {
    url: string,
    updateInterval: string,
};

type RawTtvApiSourceConfig = RawSourceConfig & {
    updateInterval: string,
};

type RawPlaylistConfig = {
    filter: string | null,
    format: string,
    sources: string | null,
};

type RawPlaylistFilterConfig = string[];

type RawPlaylistFormatConfig = {
    useExtGrp: string,
    useTvgNameAttr: string,
    useTvgLogoAttr: string,
    useGroupTitleAttr: string,
    includeGroupName: string,
    includeSourceLabel: string,
};

type Config = {
    app: AppConfig,
    server: ServerConfig,
    aceEngine: AceEngineConfig,
    stream: StreamConfig,
    ttvApi: TtvApiConfig,
    logger: LoggerConfig,
    groups: StreamGroup[],
    groupsMap: Dict<StreamGroup>,
    sources: Dict<SourceConfig>,
    playlists: Dict<PlaylistConfig>,
};

type AppConfig = {
    dataDirectory: string,
};

type ServerConfig = {
    binding: string,
    publicPath: string,
};

type AceEngineConfig = {
    path: string,
}

type StreamConfig = {
    requestTimeout: number,
    stopDelay: number,
    clientIdleTimeout: number,
    clientMaxBufferLength: number,
    clientResetBufferLength: number,
    sharedBufferLength: number,
    chunkedTransferEncoding: boolean,
}

type TtvApiConfig = {
    username: string,
    password: string,
    endpoint: string,
}

type LoggerConfig = {
    level: string,
}

type SourceConfig = {
    provider: StreamSourceType,
    label: string,
}

type AceUrlSourceConfig = SourceConfig & {
    url: string,
    updateInterval: number,
}

type TtvApiSourceConfig = SourceConfig & {
    updateInterval: number,
}

type PlaylistConfig = {
    filter: PlaylistFilterConfig,
    format: PlaylistFormatConfig,
    sources: string[],
}

type PlaylistFilterConfig = Set<string> | null;

type PlaylistFormatConfig = {
    useExtGrp: boolean,
    useTvgNameAttr: boolean,
    useTvgLogoAttr: boolean,
    useGroupTitleAttr: boolean,
    includeGroupName: boolean,
    includeSourceLabel: boolean,
};

export {
    RawMainConfig,
    RawAppConfig,
    RawServerConfig,
    RawAceEngineConfig,
    RawStreamConfig,
    RawTtvApiConfig,
    RawLoginConfig,
    RawGroupConfig,
    RawSourceConfig,
    RawAceUrlSourceConfig,
    RawTtvApiSourceConfig,
    RawPlaylistConfig,
    RawPlaylistFilterConfig,
    RawPlaylistFormatConfig,
    Config,
    AppConfig,
    ServerConfig,
    AceEngineConfig,
    StreamConfig,
    TtvApiConfig,
    LoggerConfig,
    SourceConfig,
    AceUrlSourceConfig,
    TtvApiSourceConfig,
    PlaylistConfig,
    PlaylistFilterConfig,
    PlaylistFormatConfig,
}
