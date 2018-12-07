import { Channel } from "../types";

class ChannelRepository {
    private itemsMap: Map<string, Channel> = new Map();
    private itemsByCidMap: Map<string, Channel> = new Map();

    all(): IterableIterator<Channel> {
        return this.itemsMap.values();
    }

    get(id: string): Channel {
        return this.itemsMap.get(id);
    }

    update(newChannels: Channel[]): void {
        const items = Array.from(this.itemsMap.values());
        const newIdsSet = new Set(newChannels.map(c => c.id));
        const existItems = items.filter(i => newIdsSet.has(i.id));
        const removedItems = items.filter(i => !newIdsSet.has(i.id));

        for (const item of removedItems) {
            console.log(`Remove channel "${item.name}"`);
        }

        if (existItems.length !== items.length) {
            this.itemsMap = existItems.reduce((map, item) => map.set(item.id, item), new Map());
            this.itemsByCidMap = existItems.reduce((map, item) => map.set(item.cid, item), new Map());
        }

        for (const channel of newChannels) {
            let item = this.itemsMap.get(channel.id);

            if (!item) {
                this.itemsMap.set(channel.id, channel);
                this.itemsByCidMap.set(channel.cid, channel);
                continue;
            }

            if (item.cid === channel.cid) {
                continue;
            }

            console.log(`Reject cid "${item.cid}" for a channel "${item.name}", new cid is "${channel.cid}"`);
            item.cid = channel.cid;
        }
    }
}

export { ChannelRepository }
