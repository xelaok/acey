import { sortBy } from "lodash";
import { Channel } from "../types";

function sortChannels(channels: Channel[]): Channel[] {
    return sortBy(channels, ["category", "name"]);
}

export { sortChannels }
