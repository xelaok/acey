import { splitLines, Dict } from "../../base";
import { AceChannel, ChannelGroup, ChannelSourceType } from "../../types";
import { AceStreamSourceType } from "../../ace-client";

function parsePlaylist(content: string, streamGroupMap: Dict<ChannelGroup>): AceChannel[] {
    let json;

    try {
        json = JSON.parse(content);
    }
    catch (err) {
        json = null;
    }

    if (json) {
        return parseJson(json, streamGroupMap);
    }
    else {
        return parseM3U(content, streamGroupMap);
    }
}

function parseJson(json: any, streamGroupMap: Dict<ChannelGroup>): AceChannel[] {
    const channels: any[] = json.channels;

    if (!channels) {
        return [];
    }

    return channels.map(c => ({
        id: Buffer.from(c.name).toString("hex"),
        name: c.name,
        group: streamGroupMap[c.cat] || null,
        logoUrl: null,
        source: ChannelSourceType.Ace,
        streamSource: {
            value: c.url,
            type: AceStreamSourceType.Cid,
        },
    }));
}

function parseM3U(content: string, streamGroupMap: Dict<ChannelGroup>): AceChannel[] {
    let result: AceChannel[] = [];

    const lines = splitLines(content, true, true);
    const lineCount = lines.length;

    let k = 0;

    while (k < lineCount - 1) {
        const line1 = lines[k];

        if (!line1.startsWith("#EXTINF:")) {
            k++;
            continue;
        }

        const line2 = lines[k + 1];

        if (!line2.startsWith("acestream://")) {
            k++;
            continue;
        }

        const titleIndex = line1.indexOf(",", 8);

        if (titleIndex === -1) {
            k += 2;
            continue;
        }

        const title = line1.slice(titleIndex + 1);
        const categoryStartIndex = title.lastIndexOf("(");
        const categoryEndIndex = title.lastIndexOf(")");

        let name, group;

        if (categoryStartIndex !== -1 && categoryEndIndex !== -1) {
            name = title.slice(0, categoryStartIndex).trim();
            group = streamGroupMap[title.slice(categoryStartIndex + 1, categoryEndIndex).trim()] || null;
        }
        else {
            name = title.trim();
            group = null;
        }

        if (!name) {
            k += 2;
            continue;
        }

        const cidStartIndex = line2.lastIndexOf("/");
        const cid = line2.slice(cidStartIndex + 1);

        if (!cid) {
            k += 2;
            continue;
        }

        k += 2;

        result.push({
            id: Buffer.from(name).toString("hex"),
            name,
            group,
            logoUrl: null,
            source: ChannelSourceType.Ace,
            streamSource: {
                value: cid,
                type: AceStreamSourceType.Cid,
            },
        });
    }

    return result;
}

export { parsePlaylist }
