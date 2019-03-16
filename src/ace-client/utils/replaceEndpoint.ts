import urljoin from "url-join";

function replaceEndpoint(url: string, endpoint: string): string {
    return urljoin(endpoint, url.slice(url.indexOf("/ace")));
}

export { replaceEndpoint }
