import fetch, { Response, FetchError } from "node-fetch";
import { AceApiError } from "../errors";
import { isRedirectUrl } from "./isRedirectUrl";
import { replaceEndpoint } from "./replaceEndpoint";

const redirectCodes = new Set([301, 302, 303, 307, 308]);
const redirectHeader = "Redirect to ";

async function fetchRedirectUrl(url: string, endpoint: string, timeout: number): Promise<string> {
    try {
        let location: string | null = null;

        while (true) {
            const response: Response = await fetch(
                location || url,
                {
                    timeout,
                    redirect: "manual",
                });

            const isRedirect = redirectCodes.has(response.status);

            if (!isRedirect) {
                throw new Error(`Can't fetch redirect url, status: ${response.status}`);
            }

            const text = await response.text();
            location = text.substring(redirectHeader.length);
            location = replaceEndpoint(location, endpoint);

            if (!isRedirectUrl(location, endpoint)) {
                continue;
            }

            return location;
        }
    }
    catch (err) {
        if (err instanceof FetchError) {
            throw new AceApiError(err.toString());
        }

        throw err;
    }
}

export { fetchRedirectUrl }
