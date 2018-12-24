function parseBoolean(s: string, defaultValue: boolean = false): boolean {
    switch (s.toLowerCase()[0]) {
        case "y":
        case "t":
            return true;

        case "n":
        case "f":
            return false;

        default:
            return defaultValue;
    }
}

export { parseBoolean }
