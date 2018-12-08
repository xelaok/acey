import Stream from "stream";
import * as Hapi from "hapi";
import { Response } from "node-fetch";
import uuidv4 from "uuid";
import * as aceApi from "@@libs/ace-api";
import { ChannelRepository } from "./ChannelRepository";
import { Timer } from "./Timer";
import { fireAndForget } from "../utils/fireAndForget";
import { Channel } from "../types";

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

    async resolveRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        idleTimeoutSeconds: number,
    ): Promise<Hapi.ResponseObject> {
        try {
            const { channelId } = request.params;
            const channel = this.channelRepository.get(channelId);

            if (!channel) {
                return h.response().code(404);
            }

            const clientId = uuidv4();
            const channelData = await this.resolveChannelRequest(clientId, channel);

            const stream = new Stream.PassThrough();
            const response = h.response(stream);

            for (const [name, value] of channelData.response.headers) {
                response.header(name, value);
            }

            this.enterChannel(clientId, channelId);

            const idleTimoutTimer = new Timer(idleTimeoutSeconds * 1000, () => stream.end());
            idleTimoutTimer.start();

            channelData.response.body.on("data", (chunk) => {
                stream.write(chunk);
            });

            stream.once("close", () => {
                console.log(`ChannelPool -> client stream close`);
                console.log(`   clientId = ${clientId}`);
                console.log(`   channelName = ${this.tryGetChannelName(channelId)}`);

                idleTimoutTimer.stop();
                this.leaveChannel(clientId, channelId);
            });

            response.events.on("peek", () => {
                idleTimoutTimer.reset();
            });

            return response;
        }
        catch (e) {
            console.log(e);
            return h.response().code(500);
        }
    }

    private async resolveChannelRequest(clientId: string, channel: Channel): Promise<ChannelData> {
        console.log("ChannelPool#resolveChannelRequest");
        console.log(`   clientId = ${clientId}`);
        console.log(`   channelName = ${channel.name}`);

        let result = this.channels.get(channel.id);

        if (!result) {
            result = this.requestChannel(clientId, channel);
            this.addChannel(channel.id, result);
        }

        return result;
    }

    private async requestChannel(clientId: string, channel: Channel): Promise<ChannelData> {
        console.log(`ChannelPool#requestChannel -> fetch`);
        console.log(`   clientId = ${clientId}`);
        console.log(`   channel = ${channel.name}`);

        const cid = channel.cid;
        const sid = clientId;
        const response = await aceApi.getStream(this.iproxyPath, cid, sid);

        if (response.status !== 200) {
            throw new Error(`${response.status}: ${response.statusText}`);
        }

        return {
            cid,
            sid,
            response,
        };
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
        fireAndForget(async () => {
            console.log("ChannelPool#stopChannel");
            console.log(`   channelName = ${this.tryGetChannelName(channelId)}`);

            const { cid, sid } = await this.channels.get(channelId);
            await aceApi.stopStream(this.iproxyPath, cid, sid);
        });
    }

    private tryGetChannelName(channelId: string): string {
        const channel = this.channelRepository.get(channelId);
        return channel ? channel.name : "";
    }
}

export { ChannelPool }
