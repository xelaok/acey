import { AceChannel } from "../types";

class AceRepository {
    private readonly channels: Map<string, AceChannel> = new Map();

    get(id: string): AceChannel | null {
        return this.channels.get(id) || null;
    }

    getAll(): AceChannel[] {
        return Array.from(this.channels.values());
    }

    update(channels: AceChannel[]): void {
        this.channels.clear();

        for (const c of channels) {
            this.channels.set(c.id, c);
        }
    }
}

export { AceRepository }
