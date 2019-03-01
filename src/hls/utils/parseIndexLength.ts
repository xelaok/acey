import { splitLines } from "../../base";

const EXTINF = "#EXTINF:";

function parseIndexLength(content: string): number {
    let result = 0;
    const lines = splitLines(content, true, true);

    for (const line of lines) {
        if (!line.startsWith(EXTINF)) {
            continue;
        }

        const segmentLength = Number.parseFloat(line.substr(EXTINF.length)) * 1000;
        result += segmentLength;
    }

    return result;
}

export { parseIndexLength }
