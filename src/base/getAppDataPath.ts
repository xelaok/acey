import path from "path";

function getAppDataPath(appDirectoryName: string): string {
    switch (process.platform) {
        case "win32":
            return getWin32Path(appDirectoryName);
        case "darwin":
            return getDarwinPath(appDirectoryName);
        default:
            return getPosixPath(appDirectoryName);
    }
}

function getWin32Path(appDirectoryName: string): string {
    if (!process.env.APPDATA) {
        throw new Error("APPDATA env variable is empty");
    }

    return path.join(process.env.APPDATA, appDirectoryName);
}

function getDarwinPath(appDirectoryName: string): string {
    if (!process.env.HOME) {
        throw new Error("HOME env variable is empty");
    }

    return path.join(process.env.HOME, "Library", "Application Support", appDirectoryName);
}

function getPosixPath(appDirectoryName: string): string {
    if (!process.env.HOME) {
        throw new Error("HOME env variable is empty");
    }

    return path.join(process.env.HOME, "." + appDirectoryName);
}

export { getAppDataPath }
