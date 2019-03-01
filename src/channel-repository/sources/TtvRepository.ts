import { TtvChannel } from "../../types";

class TtvRepository {
    private readonly channels: Map<string, TtvChannel> = new Map();

    get(id: string): TtvChannel | null {
        return this.channels.get(id) || null;
    }

    getAll(): TtvChannel[] {
        return Array.from(this.channels.values());
    }

    update(channels: TtvChannel[]): void {
        this.channels.clear();

        for (const c of channels) {
            this.channels.set(c.id, c);
        }
    }
}

export { TtvRepository }
