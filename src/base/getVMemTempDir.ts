import fs from "fs";

async function getVMemTempDir(): Promise<string | null> {
    return new Promise(resolve => {
        if (process.platform === "win32" || process.platform === "darwin") {
            resolve(null);
            return;
        }

        fs.stat("/dev/shm", (err) => {
            resolve(!err ? "/dev/shm" : null);
        });
    });
}

export { getVMemTempDir }
