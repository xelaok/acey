import { Request, ResponseToolkit, ResponseObject } from "hapi";
import { logger, UserError, GatewayError } from "../../base";

function createRouteHandler(fn: (request: Request, h: ResponseToolkit) => Promise<ResponseObject | symbol>) {
    return async (request: Request, h: ResponseToolkit) => {
        try {
            return await fn(request, h);
        }
        catch (err) {
            logger.error(err.stack || err);

            if (!request.active()) {
                return h.close;
            }

            switch (true) {
                case err instanceof UserError:
                    return h.response().code(400);
                case err instanceof GatewayError:
                    return h.response().code(502);
                default:
                    return h.response().code(500);
            }
        }
    };
}

export { createRouteHandler }
