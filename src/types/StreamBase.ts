import { StreamGroup } from "./StreamGroup";

type StreamBase = {
    id: string,
    name: string,
    group: StreamGroup | null,
    logoUrl: string | null,
}

export { StreamBase }
