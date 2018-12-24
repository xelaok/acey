declare const window: any;
declare const process: any;

import { platform, Platform } from '../env';

function getTime(): number | [number, number] {
    switch (platform) {
        case Platform.Browser:
            return window.performance.now();

        case Platform.NodeJS:
            return process.hrtime();

        default:
            return 0;
    }
}

export {
    getTime,
}
