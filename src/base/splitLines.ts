function splitLines(text: string, trim: boolean = false, skipEmpty: boolean = false): string[] {
    let lines = text
        .replace('\r\n', '\n')
        .split('\n')
    ;

    if (trim) {
        lines = lines.map(s => s.trim());
    }

    if (skipEmpty) {
        lines = lines.filter(s => !!s);
    }

    return lines;
}

export {
    splitLines,
}
