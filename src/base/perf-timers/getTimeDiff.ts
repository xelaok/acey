declare const window: any;
declare const process: any;

function getTimeDiff(t: number | [number, number]): number {
    if (Array.isArray(t)) {
        const diff = process.hrtime(t);
        return diff[0] * 1e3 + diff[1] / 1e6;
    }

    return window.performance.now() - t;
}

export {
    getTimeDiff,
}
