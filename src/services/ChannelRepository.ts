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

    getAll(): Channel[] {
        return Array.from(this.itemsMap.values());
    }

    update(channels: Channel[]): void {
        this.itemsMap = channels.reduce((map, c) => map.set(c.id, c), new Map());
        this.itemsByCidMap = channels.reduce((map, c) => map.set(c.cid, c), new Map());
    }
}

export { ChannelRepository }
