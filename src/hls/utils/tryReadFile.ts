import fs from "fs";
import { Readable } from "stream";
import { logger } from "../../base";

async function tryReadFile(path: string, highWaterMark: number): Promise<Readable | null> {
    return new Promise(resolve => {
        fs.access(path, fs.constants.R_OK, err => {
            if (err) {
                resolve(null);
                logger.silly(err);
                return;
            }

            resolve(
                fs.createReadStream(path, {
                    highWaterMark,
                }),
            );
        });
    });
}

export { tryReadFile }
