import { Server } from "hapi";
import { logger } from "../../base";

function handleLogRequests(server: Server): void {
    server.ext({
        type: "onRequest",
        method: function (req, h) {
            logger.debug(c => c`{cyan ${req.method.toUpperCase()}} {bold ${req.url.pathname}}`);
            return h.continue;
        }
    });
}

export { handleLogRequests }
