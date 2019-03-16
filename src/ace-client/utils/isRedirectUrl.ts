import urljoin from "url-join";

function isRedirectUrl(url: string, endpoint: string): boolean {
    return url.startsWith(urljoin(endpoint, "ace/r"));
}

export { isRedirectUrl }
