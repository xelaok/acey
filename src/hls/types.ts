type HlsIndex = {
    tags: HlsTag[];
    segments: HlsSegment[];
};

type HlsTag = {
    name: string;
    value: string;
};

type HlsSegment = {
    name: string;
    length: number;
};

export { HlsIndex, HlsTag, HlsSegment }
