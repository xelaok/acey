import { ServerConfig } from "../../config";

function formatSecureRoutePath(path: string, serverConfig: ServerConfig): string {
    if (!serverConfig.accessToken) {
        return path;
    }
    else {
        return `/${serverConfig.accessToken}${path}`;
    }
}

export { formatSecureRoutePath }
