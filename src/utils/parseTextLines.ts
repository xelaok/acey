function parseTextLines(
    content: string,
    trim: boolean = false,
    skipEmpty: boolean = false
): string[] {
    let lines = content
        .replace('\r\n', '\n')
        .split('\n')
    ;

    if (trim) {
        lines = lines.map(s => s.trim());
    }

    if (skipEmpty) {
        lines.filter(s => !s);
    }

    return lines;
}

export { parseTextLines }
