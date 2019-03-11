import nanoid from "nanoid/generate";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

function createRandomIdGenerator(base: number, length: number): () => string {
    const alphabet = ALPHABET.substr(0, Math.min(base, 64));
    return () => nanoid(alphabet, length);
}

export { createRandomIdGenerator }
