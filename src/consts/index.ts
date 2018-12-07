export * from "./selectedChannels";

const BIND_HOST = "0.0.0.0";
const BIND_PORT = 8100;
const PUBLIC_PATH = "http://192.168.0.3:8100";
const IPROXY_PATH = "http://127.0.0.1:6878";
const TTV_PLAYLIST_URL = "http://pomoyka.win/trash/ttv-list/ttv.all.player.m3u";
const TTV_PLAYLIST_UPDATE_INTERVAL = 20 * 60;

export {
    BIND_HOST,
    BIND_PORT,
    TTV_PLAYLIST_URL,
    TTV_PLAYLIST_UPDATE_INTERVAL,
    IPROXY_PATH,
    PUBLIC_PATH,
}
