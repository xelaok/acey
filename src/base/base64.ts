function encodeBase64String(s: string): string {
    return Buffer.from(s).toString("base64");
}

function decodeBase64String(s: string): string {
    return Buffer.from(s, "base64").toString();
}

export {
    encodeBase64String,
    decodeBase64String,
}
