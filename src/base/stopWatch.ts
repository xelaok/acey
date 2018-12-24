import { tryResolveSync } from './tryResolveSync';
import { getTime, getTimeDiff } from './perf-timers';

type StopWatchResult<T> = {
    time: number,
    timeText: string,
    result: T,
}

function stopWatch<T>(fn: () => T | Promise<T>): StopWatchResult<T> | Promise<StopWatchResult<T>> {
    const t = getTime();

    return tryResolveSync(
        fn(),
        result => {
            const time = getTimeDiff(t);
            const timeText = `${(time / 1000).toFixed(3)}s`;
            return { time, timeText, result };
        });
}

export {
    stopWatch,
}
