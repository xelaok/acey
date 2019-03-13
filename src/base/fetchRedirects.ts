import fetch, { RequestInit, Response } from "node-fetch";

type FetchRedirectsResult = {
    response: Response;
    location: string | null;
};

const redirectCodes = new Set([301, 302, 303, 307, 308]);
const redirectHeader = "Location: ";

async function fetchRedirects(url: string, requestInit?: RequestInit): Promise<FetchRedirectsResult> {
    const requestInitWrap: RequestInit | undefined = requestInit && {
        ...requestInit,
        redirect: "manual",
    };

    let location: string | null = null;

    while (true) {
        const response: Response = await fetch(location || url, requestInitWrap);
        const isRedirect = redirectCodes.has(response.status);

        if (isRedirect) {
            const text = await response.text();
            location = text.substring(redirectHeader.length);
            continue;
        }

        return {
            response,
            location,
        };
    }
}

export { fetchRedirects, FetchRedirectsResult }
