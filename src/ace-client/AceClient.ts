import urljoin from "url-join";
import fetch, { Response, FetchError } from "node-fetch";
import { handleWithRetry, generateRandomId, createLogger, stopWatch, Logger } from "../base";
import { AceApiConfig } from "../config";
import { AceStreamSource, AceStream } from "./types";
import { AceApiError, RequestTimeoutAceApiError } from "./errors";
import { formatStreamSourceQuery } from "./utils/formatStreamSourceQuery";
import { fetchRedirectUrl } from "./utils/fetchRedirectUrl";
import { parseInfohash } from "./utils/parseInfohash";

class AceClient {
    private readonly config: AceApiConfig;
    private readonly logger: Logger;

    constructor(config: AceApiConfig) {
        this.config = config;
        this.logger = createLogger(c => c`{cyan Ace}`);
    }

    async requestStream(source: AceStreamSource, alias: string): Promise<AceStream> {
        const logger = this.createChannelLogger(`request ${alias}`);
        logger.debug("..");
        try {
            const sid = generateRandomId(62, 16);

            const { timeText, result: redirectUrl } = await stopWatch(() => {
                return handleWithRetry(
                    retryNum => {
                        if (retryNum > 0) {
                            logger.debug(c => c`.. retry {bold ${retryNum.toString()}}`);
                        }

                        return fetchRedirectUrl(
                            this.formatApiUrl(`getstream?${formatStreamSourceQuery(source, sid)}&.mp4`),
                            this.config.endpoint,
                            this.config.requestTimeout,
                        );
                    },
                    1000, 2,
                );
            });

            const infohash = parseInfohash(redirectUrl);
            const commandUrl = redirectUrl.replace("/r/", "/cmd/");

            const result = {
                infohash,
                redirectUrl,
                commandUrl,
            };

            logger.debug(c => c`success ({bold ${timeText}})`);
            return result;
        }
        catch (err) {
            switch (true) {
                case err instanceof RequestTimeoutAceApiError:
                    logger.debug(c => c`{yellow timeout}`);
                    break;
                default:
                    logger.warn(c => c`failed:`, [err.toString()]);
                    break;
            }

            throw err;
        }
    }

    async requestStreamContent(stream: AceStream, alias: string): Promise<Response> {
        const logger = this.createChannelLogger(`request ${alias} content`);
        logger.debug("..")
        try {
            const { result: response, timeText } = await stopWatch(() => {
                return this.makeRequest(stream.redirectUrl);
            });

            logger.debug(c => c`success ({bold ${timeText}})`);
            return response;
        }
        catch (err) {
            switch (true) {
                case err instanceof RequestTimeoutAceApiError:
                    logger.debug(c => c`{yellow timeout}`);
                    break;
                default:
                    logger.warn(c => c`failed:`, [err.toString()]);
                    break;
            }

            throw err;
        }
    }

    async requestStopStream(stream: AceStream, alias: string): Promise<void> {
        const logger = this.createChannelLogger(`request stop ${alias}`);
        logger.debug("..");
        try {
            const { timeText, result: response } = await stopWatch(async () => {
                return this.makeRequest(`${stream.commandUrl}?method=stop`);
            });

            logger.debug(c => c`success: {bold ${response.status.toString()}} ({bold ${timeText}})`);
        }
        catch (err) {
            switch (true) {
                case err instanceof RequestTimeoutAceApiError:
                    logger.debug(c => c`{yellow timeout}`);
                    break;
                default:
                    logger.warn(c => c`failed:`, [err.toString()]);
                    break;
            }
        }
    }

    private formatApiUrl(path: string): string {
        return urljoin(this.config.endpoint, "ace", path);
    }

    private createChannelLogger(alias: string): Logger {
        return createLogger(c => c`{cyan ${this.logger.prefix} > ${alias}}`);
    }

    private async makeRequest(url: string): Promise<Response> {
        let response;

        try {
            response = await fetch(url, {
                timeout: this.config.requestTimeout,
            });
        }
        catch (err) {
            switch (true) {
                case err instanceof FetchError && err.type === "request-timeout":
                    throw new RequestTimeoutAceApiError(err.message);
                case err instanceof FetchError:
                    throw new AceApiError(err.message);
                default:
                    throw err;
            }
        }

        if (response.status !== 200) {
            throw new AceApiError(`Response status: ${response.status}, ${response.statusText}`);
        }

        return response;
    }
}

export { AceClient }
