import Stream from "stream";
import * as Hapi from "hapi";
import fetch, { Response } from "node-fetch";
import uuidv4 from "uuid/v4";
import { ChannelRepository } from "./ChannelRepository";

type ChannelData = {
    cid: string,
    sid: string,
    response: Response,
};

class ChannelPool {
    private readonly iproxyPath: string;
    private readonly channelRepository: ChannelRepository;
    private channels: Map<string, Promise<ChannelData>> = new Map();
    private clientChannelMap: Map<string, string> = new Map();

    constructor(iproxyPath: string, channelRepository: ChannelRepository) {
        this.iproxyPath = iproxyPath;
        this.channelRepository = channelRepository;
    }

    async resolveRequest(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        try {
            const { channelId } = request.params;
            const clientId = uuidv4();

            let channelDataPromise = this.channels.get(channelId);

            if (!channelDataPromise) {
                channelDataPromise = new Promise(async (resolve, reject) => {
                    try {
                        const channel = this.channelRepository.get(channelId);
                        const cid = channel.cid;
                        const sid = clientId;
                        const url = `${this.iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${sid}`;

                        console.log(`ChannelPool#resolveRequest -> fetch`);
                        console.log(`   url = ${url}`);

                        const response = await fetch(url);

                        if (response.status !== 200) {
                            reject(`${response.status}: ${response.statusText}`);
                            return;
                        }

                        resolve({
                            cid,
                            sid,
                            response,
                        });
                    }
                    catch (error) {
                        reject(error);
                    }
                });

                this.addChannel(channelId, channelDataPromise);
            }

            const channelData = await channelDataPromise;
            const stream = channelData.response.body.pipe(new Stream.PassThrough());
            const response = h.response(stream);

            for (const [name, value] of channelData.response.headers) {
                response.header(name, value);
            }

            this.enterChannel(clientId, channelId);

            stream.once("close", () => {
                console.log(`ChannelPool -> client stream close`);
                console.log(`   clientId = ${clientId}`);
                console.log(`   channelName = ${this.tryGetChannelName(channelId)}`);

                this.leaveChannel(clientId, channelId);
            });

            return response;
        }
        catch (e) {
            console.log(e);
            return h.response().code(500);
        }
    }

    private hasClients(channelId: string): boolean {
        for (const id of this.clientChannelMap.values()) {
            if (id === channelId) {
                return true;
            }
        }

        return false;
    }

    private hasChannel(channelId: string): boolean {
        return this.channels.has(channelId);
    }

    private enterChannel(clientId: string, channelId: string): void {
        console.log("ChannelPool#enterChannel");
        console.log(`   clientId = ${clientId}`);
        console.log(`   channelName = ${this.tryGetChannelName(channelId)}`);

        this.addClient(clientId, channelId);
    }

    private leaveChannel(clientId: string, channelId: string): void {
        console.log("ChannelPool#leaveChannel");
        console.log(`   clientId = ${clientId}`);
        console.log(`   channelName = ${this.tryGetChannelName(channelId)}`);

        this.removeClient(clientId);

        if (!this.hasChannel(channelId) || this.hasClients(channelId)) {
            return;
        }

        this.stopChannel(channelId);
        this.removeChannel(channelId);
    }

    private addClient(clientId: string, channelId: string): void {
        this.clientChannelMap.set(clientId, channelId);
    }

    private removeClient(clientId: string): void {
        this.clientChannelMap.delete(clientId);
    }

    private addChannel(channelId: string, channelDataPromise: Promise<ChannelData>): void {
        this.channels.set(channelId, channelDataPromise);
    }

    private removeChannel(channelId: string): void {
        this.channels.delete(channelId);
    }

    private stopChannel(channelId: string): void {
        this.stopChannelAsync(channelId);
    }

    private async stopChannelAsync(channelId: string): Promise<void> {
        const { cid, sid } = await this.channels.get(channelId);

        console.log("ChannelPool#stopChannel");
        console.log(`   channelName = ${this.tryGetChannelName(channelId)}`);

        const statsUrl = `${this.iproxyPath}/ace/getstream?id=${cid}&.mp4&sid=${sid}&format=json`;
        const res = await fetch(statsUrl);
        const stats: any = await res.json();
        const cmdUrl: string = this.normalizeAceIProxyUrl(stats.response["command_url"]) + "?method=stop";

        await fetch(cmdUrl);
    }

    private tryGetChannelName(channelId: string): string {
        const channel = this.channelRepository.get(channelId);
        return channel ? channel.name : "";
    }

    private normalizeAceIProxyUrl(url: string): string {
        return this.iproxyPath + url.slice(url.indexOf("/ace"));
    }
}

export { ChannelPool }
