import { TtvStream } from "../../types";

class TtvStreamRepository {
    private itemsMap: Map<number, TtvStream> = new Map();

    all(): IterableIterator<TtvStream> {
        return this.itemsMap.values();
    }

    get(id: number): TtvStream | null {
        return this.itemsMap.get(id) || null;
    }

    getAll(): TtvStream[] {
        return Array.from(this.itemsMap.values());
    }

    update(channels: TtvStream[]): void {
        this.itemsMap = channels.reduce((map, c) => map.set(c.id, c), new Map());
    }
}

export { TtvStreamRepository }
