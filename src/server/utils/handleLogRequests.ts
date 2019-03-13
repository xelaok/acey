import { Server, ResponseObject } from "hapi";
import { logger, getTime, getTimeDiff } from "../../base";

type RequestData = {
    requestTime: number | [number, number];
};

function handleLogRequests(server: Server): void {
    server.ext({
        type: "onRequest",
        method: function (req, h) {
            const data: RequestData = {
                requestTime: getTime(),
            };

            (req as any)["$data"] = data;

            logger.debug(c => c`{cyan ${req.method.toUpperCase()} >>} ${req.url.pathname}`);
            return h.continue;
        }
    });

    server.ext({
        type: "onPreResponse",
        method: function (req, h) {
            const data = ((req as any)["$data"]) as RequestData;
            const statusCode = (req.response as ResponseObject).statusCode;
            const statusCodeString = statusCode ? statusCode.toString() : "---";
            const time = getTimeDiff(data.requestTime);
            const timeString = (time / 1000).toFixed(3) + "s";

            logger.debug(c => c`{cyan ${req.method.toUpperCase()}} {green <<} ${req.url.pathname} {bold ${statusCodeString}} ({bold ${timeString}})`);
            return h.continue;
        }
    });
}

export { handleLogRequests }
