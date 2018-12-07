import { HOUR } from "../libs/consts";
import { RejectedCids } from "../services/RejectedCids";

const INTERVAL = HOUR;

class RejectedCidsCleaner {
    private readonly rejectedCids: RejectedCids;
    private timeout: NodeJS.Timeout;
    private isRunning: boolean = false;

    constructor(rejectedCids: RejectedCids) {
        this.rejectedCids = rejectedCids;
    }

    start() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        this.timeout = global.setInterval(
            () => this.rejectedCids.removeOld(),
            INTERVAL,
        );
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        global.clearInterval(this.timeout);
    }
}

export { RejectedCidsCleaner }
