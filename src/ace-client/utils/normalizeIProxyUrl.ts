import urljoin from "url-join";

function normalizeIProxyUrl (iproxyPath: string, url: string): string {
    return urljoin(iproxyPath, url.slice(url.indexOf("/ace")));
}

export { normalizeIProxyUrl }
