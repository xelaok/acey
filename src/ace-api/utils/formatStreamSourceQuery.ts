import qs from "qs";
import { StreamSource, StreamSourceType } from "../types";

function formatStreamSourceQuery(source: StreamSource, sid: string): string {
    switch (source.type) {
        case StreamSourceType.Cid:
            return qs.stringify({
                id: source.value,
                sid: sid,
            });
        case StreamSourceType.Torrent:
            return qs.stringify({
                url: source.value,
                sid: sid,
            });
        case StreamSourceType.Infohash:
            return qs.stringify({
                infohash: source.value,
                sid: sid,
            });
        default:
            throw new Error(`Unkown source type: "${source.type}"`);
    }
}

export { formatStreamSourceQuery }
