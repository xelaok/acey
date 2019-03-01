import { AceStreamSource } from "../../ace-api";
import { Channel } from "../Channel";

type AceChannel = Channel & {
    streamSource: AceStreamSource;
};

export { AceChannel }
