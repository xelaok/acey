import nanoid from "nanoid/generate";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function getRandomIdGenerator(base: number, length: number): () => string {
    const alphabet = ALPHABET.substr(0, base);
    return () => nanoid(alphabet, length);
}

export { getRandomIdGenerator }
