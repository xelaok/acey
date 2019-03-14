import { PassThrough } from "stream";
import { Headers } from "node-fetch";

type AceStreamClient = {
    stream: PassThrough;
    responseHeaders: Headers;
};

export { AceStreamClient }
