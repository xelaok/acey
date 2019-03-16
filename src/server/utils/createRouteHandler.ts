import { Request, ResponseToolkit, ResponseObject } from "hapi";
import { logger, UserError, GatewayError } from "../../base";
import { AceApiError } from "../../ace-client";
import { TtvApiError } from "../../ttv-client";

function createRouteHandler(fn: (request: Request, h: ResponseToolkit) => Promise<ResponseObject | symbol>) {
    return async (request: Request, h: ResponseToolkit) => {
        try {
            return await fn(request, h);
        }
        catch (err) {
            let code;

            switch (true) {
                case err instanceof UserError:
                    code = 400;
                    logger.warn(err.toString());
                    break;
                case err instanceof AceApiError:
                case err instanceof TtvApiError:
                    code = 502;
                    logger.silly(err.toString());
                    break;
                case err instanceof GatewayError:
                    code = 502;
                    logger.warn(err.toString());
                    break;
                default:
                    code = 500;
                    logger.error(err.stack || err);
                    break;
            }

            return request.active() ? h.response().code(code) : h.close;
        }
    };
}

export { createRouteHandler }
