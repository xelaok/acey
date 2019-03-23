import nanoid from "nanoid/generate";
import { baseEncodeTables, BaseEncode } from "./baseEncodeTables";

function generateRandomId(base: BaseEncode, length: number): string {
    return nanoid(baseEncodeTables[base], length);
}

export { generateRandomId }
