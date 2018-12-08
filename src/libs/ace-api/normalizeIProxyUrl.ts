function normalizeIProxyUrl (iproxyPath: string, url: string): string {
    return iproxyPath + url.slice(url.indexOf("/ace"));
}

export { normalizeIProxyUrl }
