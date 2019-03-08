import { splitLines } from "../../base";
import { HlsIndex, HlsTag, HlsSegment } from "../types";

const EXTX = "#EXT-X-";
const EXTINF = "#EXTINF:";

function parseIndex(content: string): HlsIndex {
    const lines = splitLines(content, true, true);

    let tags = [];
    let segments = [];
    let lineIndex = 0;

    while (lineIndex < lines.length) {
        const line = lines[lineIndex];

        if (isTag(line)) {
            const tag = parseTag(line);
            tags.push(tag);
            lineIndex += 1;
            continue;
        }

        if (isSegment(line)) {
            const segment = parseSegment(line, lines[lineIndex + 1]);
            segments.push(segment);
            lineIndex += 2;
            continue;
        }

        lineIndex +=1;
    }

    return { tags, segments };
}

function isTag(line: string) {
    return line.startsWith(EXTX);
}

function isSegment(line: string) {
    return line.startsWith(EXTINF);
}

function parseTag(line: string): HlsTag {
    const dividerIndex = line.indexOf(":");
    const name = line.substr(0, dividerIndex).trim();
    const value = line.substr(dividerIndex + 1).trim();

    return { name, value };
}

function parseSegment(line1: string, line2: string): HlsSegment {
    const name = line2;
    const length = Number.parseFloat(line1.substr(EXTINF.length)) * 1e3;

    return { name, length };
}

export { parseIndex }
