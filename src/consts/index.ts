export * from "./selectedChannels";

const BIND_HOST = "0.0.0.0";
const BIND_PORT = 8100;
const PUBLIC_PATH = "http://192.168.0.3:8100";
const IPROXY_PATH = "http://127.0.0.1:6878";
const ACE_PLAYLIST_URL = "http://91.92.66.82/trash/ttv-list/as.all.player.m3u";
const ACE_PLAYLIST_UPDATE_INTERVAL = 20 * 60;
const CLIENT_IDLE_TIMEOUT = 15;

export {
    BIND_HOST,
    BIND_PORT,
    ACE_PLAYLIST_URL,
    ACE_PLAYLIST_UPDATE_INTERVAL,
    IPROXY_PATH,
    PUBLIC_PATH,
    CLIENT_IDLE_TIMEOUT,
}
