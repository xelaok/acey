import { AceStream } from "../../types";

class AceStreamRepository {
    private itemsMap: Map<string, AceStream> = new Map();

    all(): IterableIterator<AceStream> {
        return this.itemsMap.values();
    }

    get(id: string): AceStream | null {
        return this.itemsMap.get(id) || null;
    }

    getAll(): AceStream[] {
        return Array.from(this.itemsMap.values());
    }

    update(channels: AceStream[]): void {
        this.itemsMap = channels.reduce((map, c) => map.set(c.id, c), new Map());
    }
}

export { AceStreamRepository }
