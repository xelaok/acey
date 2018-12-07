import { DAY } from "../libs/consts";

type RejectedCidItem = {
    cid: string,
    timestamp: number,
}

const OLD_ITEMS_THRESHOLD = DAY;

class RejectedCids {
    items: RejectedCidItem[] = [];
    private cidSet: Set<string> = new Set();

    add(cid: string): void {
        if (this.cidSet.has(cid)) {
            return;
        }

        this.items.push({
            cid,
            timestamp: Date.now(),
        });

        this.cidSet.add(cid);
    }

    has(cid: string): boolean {
        return this.cidSet.has(cid);
    }

    removeOld(): void {
        const now = Date.now();
        const newItems = this.items.filter(item => now - item.timestamp < OLD_ITEMS_THRESHOLD);

        if (newItems.length === this.items.length) {
            return;
        }

        this.items = newItems;
        this.cidSet = new Set(newItems.map(item => item.cid));
    }
}

export { RejectedCids }
