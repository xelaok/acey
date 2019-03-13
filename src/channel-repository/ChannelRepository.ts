import { Channel, ChannelSource, AceChannel, TtvChannel } from "../types";
import { AceRepository } from "./AceRepository";
import { TtvRepository } from "./TtvRepository";

class ChannelRepository {
    private readonly aceRepository: AceRepository;
    private readonly ttvRepository: TtvRepository;

    constructor() {
        this.aceRepository = new AceRepository();
        this.ttvRepository = new TtvRepository();
    }

    getChannel(source: ChannelSource, id: string): Channel | null {
        switch (source) {
            case ChannelSource.Ace:
                return this.aceRepository.get(id);
            case ChannelSource.Ttv:
                return this.ttvRepository.get(id);
            default:
                return null;
        }
    }

    getAceChannels(): AceChannel[] {
        return this.aceRepository.getAll();
    }

    getTtvChannels(): TtvChannel[] {
        return this.ttvRepository.getAll();
    }

    updateAceChannels(channels: AceChannel[]): void {
        this.aceRepository.update(channels);
    }

    updateTtvChannels(channels: TtvChannel[]): void {
        this.ttvRepository.update(channels);
    }
}

export { ChannelRepository }
