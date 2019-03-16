type AceStream = {
    infohash: string;
    redirectUrl: string;
    commandUrl: string;
};

type AceStreamSource = {
    value: string;
    type: AceStreamSourceType;
};

enum AceStreamSourceType {
    Cid,
    Torrent,
    Infohash,
}

export { AceStream, AceStreamSource, AceStreamSourceType }
