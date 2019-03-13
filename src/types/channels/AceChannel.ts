import { AceStreamSource } from "../../ace-client";
import { Channel } from "../Channel";

type AceChannel = Channel & {
    streamSource: AceStreamSource;
};

export { AceChannel }
