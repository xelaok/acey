// adopted from loader-utils/getHashDigest.js

type BaseEncode = 16 | 26 | 32 | 36 | 49 | 52 | 58 | 62 | 64;

const baseEncodeTables: Record<BaseEncode, string> = {
    16: "0123456789abcdef",
    26: "abcdefghijklmnopqrstuvwxyz",
    32: "123456789abcdefghjkmnpqrstuvwxyz", // no 0lio
    36: "0123456789abcdefghijklmnopqrstuvwxyz",
    49: "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", // no lIO
    52: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    58: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", // no 0lIO
    62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    64: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_",
};

export { baseEncodeTables, BaseEncode }
