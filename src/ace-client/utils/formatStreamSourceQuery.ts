import qs from "qs";
import { AceStreamSource, AceStreamSourceType } from "../types";

function formatStreamSourceQuery(source: AceStreamSource, sid: string): string {
    switch (source.type) {
        case AceStreamSourceType.Cid:
            return qs.stringify({
                id: source.value,
                sid: sid,
            });
        case AceStreamSourceType.Torrent:
            return qs.stringify({
                url: source.value,
                sid: sid,
            });
        case AceStreamSourceType.Infohash:
            return qs.stringify({
                infohash: source.value,
                sid: sid,
            });
        default:
            throw new Error(`Unkown source type: "${source.type}"`);
    }
}

export { formatStreamSourceQuery }
