import { Server, Request, ResponseObject } from "hapi";
import { logger, getTime, getTimeDiff } from "../../base";

type RequestInfo = {
    requestTime: number | [number, number];
    responseTime?: number | [number, number];
};

function handleLogRequests(server: Server): void {
    const requestTimeMap = new Map<Request, RequestInfo>();

    server.ext({
        type: 'onRequest',
        method: function (req, h) {
            requestTimeMap.set(req, { requestTime: getTime() });
            logger.debug(`${req.method.toUpperCase()} ${req.url.pathname} ..`);
            return h.continue;
        }
    });

    server.ext({
        type: 'onPreResponse',
        method: function (req, h) {
            if (!req.response) {
                return h.continue;
            }

            const time = requestTimeMap.get(req);
            requestTimeMap.delete(req);

            if (!time) {
                return h.continue;
            }

            const timeDiff = getTimeDiff(time.requestTime);
            const seconds = (timeDiff / 1000).toFixed(3) + "s";
            const statusCode = (req.response as ResponseObject).statusCode;

            logger.debug(`${req.method.toUpperCase()} ${req.url.pathname} > ${statusCode ? statusCode : "---"} ${seconds && "(" + seconds + ")"}`);

            time.responseTime = getTime();

            req.raw.res.on("finish", () => {
                if (!time || !time.responseTime) {
                    return;
                }

                const timeDiff = getTimeDiff(time.responseTime);
                const seconds = timeDiff && (timeDiff / 1000).toFixed(3) + "s";

                logger.debug(`${req.method.toUpperCase()} ${req.url.pathname} > end ${seconds && "(" + seconds + ")"}`);
            });

            return h.continue;
        }
    });
}

export { handleLogRequests }
