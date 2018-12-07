import Stream from "stream";
import * as Hapi from "hapi";
import fetch, { Response } from "node-fetch";
import uuidv4 from "uuid/v4";
import { ChannelsRepository } from "./ChannelsRepository";

type PoolItem = {
    cid: string,
    clientId: string,
    channelId: string,
    response: Response,
};

class StreamPool {
    private readonly iproxyPath: string;
    private readonly channelsRepository: ChannelsRepository;
    private items: Map<string, Promise<PoolItem>> = new Map();
    private clientStreamMap: Map<string, string> = new Map();

    constructor(iproxyPath: string, channelsRepository: ChannelsRepository) {
        this.iproxyPath = iproxyPath;
        this.channelsRepository = channelsRepository;
    }

    async resolveRequest(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        try {
            const { channelId } = request.params;
            const clientId = uuidv4();

            let itemPromise = this.items.get(channelId);

            if (!itemPromise) {
                itemPromise = new Promise(async (resolve, reject) => {
                    const name = Buffer.from(channelId, "hex").toString("utf8");
                    const channel = this.channelsRepository.getItem(name);
                    const cid = channel.cid;
                    const url = `${this.iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${clientId}`;

                    console.log(`StreamPool#resolveRequest -> fetch`);
                    console.log(`   url = "${url}"`);

                    const response = await fetch(url);

                    if (response.status !== 200) {
                        reject(`${response.status}: ${response.statusText}`);
                        return;
                    }

                    resolve({
                        cid,
                        clientId,
                        channelId,
                        response
                    });
                });

                this.items.set(channelId, itemPromise);
            }

            const item = await itemPromise;
            const stream = item.response.body.pipe(new Stream.PassThrough());
            const response = h.response(stream);

            for (const [name, value] of item.response.headers) {
                response.header(name, value);
            }

            this.enterStream(clientId, channelId);

            stream.once("close", () => {
                console.log(`StreamPool#resolveRequest -> client stream close`);
                console.log(`   clientId: ${clientId}`);
                console.log(`   streamId: ${channelId})`);

                this.leaveStream(clientId, channelId);
            });

            return response;
        }
        catch (e) {
            console.log(e);
            return h.response().code(500);
        }
    }

    private hasClients(streamId: string): boolean {
        for (const id of this.clientStreamMap.values()) {
            if (id === streamId) {
                return true;
            }
        }

        return false;
    }

    private enterStream(clientId: string, streamId: string): void {
        console.log("StreamPool#tryEnterStream", clientId, streamId);
        this.clientStreamMap.set(clientId, streamId);
    }

    private leaveStream(clientId: string, streamId: string): void {
        console.log("StreamPool#tryLeaveStream", clientId, streamId);

        this.clientStreamMap.delete(clientId);

        if (!this.items.has(streamId)) {
            return;
        }

        if (!this.hasClients(streamId)) {
            this.stopStream(streamId);
        }

        this.items.delete(streamId);
    }

    private stopStream(streamId: string): void {
        this.stopStreamAsync(streamId);
    }

    private async stopStreamAsync(streamId: string): Promise<void> {
        const { cid, clientId } = await this.items.get(streamId);
        const statsUrl = `${this.iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${clientId}&format=json`;
        const res = await fetch(statsUrl);
        const stats: any = await res.json();
        const cmdUrl: string = this.normalizeAceIProxyUrl(stats.response["command_url"]) + "?method=stop";
        await fetch(cmdUrl);
    }

    private normalizeAceIProxyUrl(url: string): string {
        return this.iproxyPath + url.slice(url.indexOf("/ace"));
    }
}

export { StreamPool }
