import { PassThrough } from "stream";
import { Response } from "node-fetch";

type AceStreamRequestResult = {
    stream: PassThrough;
    response$: Promise<Response | null>;
};

export { AceStreamRequestResult }
