import { Request } from "hapi";

function getBaseRequestPath(request: Request): string {
    const requestHost = request.info.host;
    const serverProtocol = request.server.info.protocol;

    const forwardedHost = request.headers["x-forwarded-host"];
    const forwardedPort = request.headers["x-forwarded-port"];
    const forwardedProtocol = request.headers["x-forwarded-proto"];

    let result = (forwardedProtocol || serverProtocol) + "://" + (forwardedHost || requestHost);

    if (forwardedHost && forwardedPort && forwardedProtocol) {
        const isExplicitPort = (
            (forwardedProtocol === "http" && forwardedPort !== "80") ||
            (forwardedProtocol === "https" && forwardedPort !== "443")
        );

        if (isExplicitPort) {
            result += ":" + forwardedPort;
        }
    }

    return result;
}

export { getBaseRequestPath }
