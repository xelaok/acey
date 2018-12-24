import * as Hapi from "hapi";
import { Response } from "node-fetch";
import { StreamConfig } from "../config";
import { ClientResponse } from "./ClientResponse";

class Client {
    onClosed: (() => void) | null;
    private response: ClientResponse;

    constructor(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        streamConfig: StreamConfig,
        streamResponse$: Promise<Response | null>,
        alias: string,
        streamAlias: string,
    ) {
        this.response = new ClientResponse(
            request,
            h,
            streamConfig,
            streamResponse$,
            alias,
            streamAlias,
        );

        this.response.onClosed = () => {
            this.onClosed && this.onClosed();
        };
    }

    get response$(): Promise<Hapi.ResponseObject | symbol> {
        return this.response.result$;
    }

    handle(): void {
        this.response.handle();
    }

    write(chunk: Buffer): void {
        this.response.write(chunk);
    }

    close(): void {
        this.response.close();
    }
}

export { Client }
