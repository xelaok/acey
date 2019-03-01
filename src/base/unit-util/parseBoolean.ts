function parseBoolean(s: string, defaultValue: boolean = false): boolean {
    switch (s.toLowerCase()[0]) {
        case "1":
        case "y":
        case "t":
            return true;

        case "0":
        case "n":
        case "f":
            return false;

        default:
            return defaultValue;
    }
}

export { parseBoolean }
