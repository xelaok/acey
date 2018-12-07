import { RejectedCids } from "./RejectedCids";
import { Channel } from "../types";

class ChannelsRepository {
    private rejectedCids: RejectedCids;
    private itemsMap: Map<string, Channel> = new Map();
    private itemsByCidMap: Map<string, Channel> = new Map();

    constructor(rejectedCids: RejectedCids) {
        this.rejectedCids = rejectedCids;
    }

    items(): IterableIterator<Channel> {
        return this.itemsMap.values();
    }

    getItem(name: string): Channel {
        return this.itemsMap.get(name);
    }

    update(newChannels: Channel[], removeNonExist: boolean, replaceByCid: boolean): void {
        if (removeNonExist) {
            const items = Array.from(this.itemsMap.values());
            const newNamesSet = new Set(newChannels.map(c => c.name));
            const existItems = items.filter(i => newNamesSet.has(i.name));
            const removedItems = items.filter(i => !newNamesSet.has(i.name));

            for (const item of removedItems) {
                console.log(`Remove channel "${item.name}"`);
            }

            if (existItems.length !== items.length) {
                this.itemsMap = existItems.reduce((map, item) => map.set(item.name, item), new Map());
                this.itemsByCidMap = existItems.reduce((map, item) => map.set(item.cid, item), new Map());
            }
        }

        for (const channel of newChannels) {
            if (this.rejectedCids.has(channel.cid)) {
                continue;
            }

            let item;

            if (replaceByCid) {
                item = this.itemsByCidMap.get(channel.cid);

                if (item) {
                    this.itemsMap.set(channel.name, channel);
                    this.itemsByCidMap.set(channel.cid, channel);
                    continue;
                }
            }

            item = this.itemsMap.get(channel.name);

            if (!item) {
                this.itemsMap.set(channel.name, channel);
                this.itemsByCidMap.set(channel.cid, channel);
                continue;
            }

            if (item.cid === channel.cid) {
                continue;
            }

            console.log(`Reject cid "${item.cid}" for a channel "${item.name}", new cid is "${channel.cid}"`);
            this.rejectedCids.add(item.cid);
            item.cid = channel.cid;
        }
    }
}

export { ChannelsRepository }
