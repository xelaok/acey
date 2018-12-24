import { Server, Request, ResponseToolkit, ResponseObject } from "hapi";
import { logger } from "../../base";
import { TtvApi } from "../../ttv-api";
import { AceStreamRepository } from "../../repositories";
import { TtvStreamRepository } from "../../repositories";
import { Streams } from "../../streams";

function handleGetStream(
    server: Server,
    ttvApi: TtvApi,
    aceStreamRepository: AceStreamRepository,
    ttvStreamRepository: TtvStreamRepository,
    streams: Streams,
): void {
    server.route({
        method: "GET",
        path: "/s/{type}/{id}.mp4",
        handler: (request: Request, h: ResponseToolkit) => {
            switch (request.params.type) {
                case "ace":
                    return getAceStream(
                        request,
                        h,
                        aceStreamRepository,
                        streams,
                    );

                case "ttv":
                    return getTtvStream(
                        request,
                        h,
                        ttvApi,
                        ttvStreamRepository,
                        streams,
                    );

                default:
                    return h.response().code(404);
            }
        },
    });
}

async function getAceStream(
    request: Request,
    h: ResponseToolkit,
    aceStreamRepository: AceStreamRepository,
    streams: Streams,
): Promise<ResponseObject | symbol> {
    const id = request.params.id;
    const stream = aceStreamRepository.get(id);

    if (!stream) {
        return h.response().code(404);
    }

    logger.verbose(`Request ace channel "${stream.name}"`);
    return streams.handleRequest(request, h, stream.source, stream.name);
}

async function getTtvStream(
    request: Request,
    h: ResponseToolkit,
    ttvApi: TtvApi,
    ttvStreamRepository: TtvStreamRepository,
    streams: Streams,
): Promise<ResponseObject | symbol> {
    const id = Number.parseInt(request.params.id, 10);
    const stream = ttvStreamRepository.get(id);

    if (!stream) {
        return h.response().code(404);
    }

    logger.verbose(`Request ttv channel "${stream.name}"`);

    const source = await ttvApi.getAceStreamSource(id);
    return streams.handleRequest(request, h, source, stream.name);
}

export { handleGetStream }
