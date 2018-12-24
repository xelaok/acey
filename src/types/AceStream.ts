import * as aceApi from "../ace-api";
import { StreamBase } from "./StreamBase";

type AceStream = StreamBase & {
    source: aceApi.StreamSource,
}

export { AceStream }
