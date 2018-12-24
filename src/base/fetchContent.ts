import fetch from "node-fetch";

type FetchContentResult = {
    content: string,
    lastModifiedString: string | null,
};

async function fetchContent(
    url: string,
    ifModifiedSinceString: string | null,
): Promise<FetchContentResult | null> {
    const headers: { [name: string]: string } = {};

    if (ifModifiedSinceString) {
        headers["if-modified-since"] = ifModifiedSinceString;
    }

    const response = await fetch(url, {
        compress: true,
        headers: headers,
    });

    if (response.status === 304) {
        return null;
    }

    const content = await response.text();

    return {
        content,
        lastModifiedString: response.headers.get("last-modified") || null,
    };
}

export { fetchContent, FetchContentResult }
