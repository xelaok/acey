import { Channel, ChannelSourceType, AceChannel } from "../types";
import { AceRepository } from "./AceRepository";

class ChannelRepository {
    private readonly aceRepository: AceRepository;

    constructor() {
        this.aceRepository = new AceRepository();
    }

    getChannel(source: ChannelSourceType, id: string): Channel | null {
        switch (source) {
            case ChannelSourceType.Ace:
                return this.aceRepository.get(id);
            default:
                return null;
        }
    }

    getAceChannels(): AceChannel[] {
        return this.aceRepository.getAll();
    }

    updateAceChannels(channels: AceChannel[]): void {
        this.aceRepository.update(channels);
    }
}

export { ChannelRepository }
