import { GatewayError, UserError } from "./errors";

function formatErrorMessage(err: any): string {
    switch (true) {
        case err instanceof UserError:
        case err instanceof GatewayError:
            return err.toString();
        default:
            return err.stack || err;
    }
}

export { formatErrorMessage }
