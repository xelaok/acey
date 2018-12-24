declare const window: any;
declare const process: any;

enum Platform {
    Browser,
    NodeJS,
    Unknown,
}

function getPlatform(): Platform {
    if (typeof(window) !== 'undefined') {
        return Platform.Browser;
    }

    if (typeof(process) !== 'undefined') {
        return Platform.NodeJS;
    }

    return Platform.Unknown;
}

const platform = getPlatform();

export {
    platform,
    Platform,
}
