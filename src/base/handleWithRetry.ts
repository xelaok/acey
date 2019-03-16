function handleWithRetry<T>(
    fn: (retryNum: number) => Promise<T>,
    timeout: number,
    retryCount: number,
    log?: boolean,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let retryNum = 0;
        let handled = false;
        let t = Date.now();

        handle();
        schedule();

        function handle() {
            const n = retryNum;

            fn(n)
                .then(result => {
                    log && console.log(n, ((Date.now() - t) / 1000).toFixed(3));

                    if (handled) {
                        return;
                    }

                    handled = true;
                    resolve(result);
                })
                .catch(err => {
                    if (handled) {
                        return;
                    }

                    handled = true;
                    reject(err);
                });
        }

        function schedule() {
            setTimeout(
                () => {
                    if (handled || retryNum === retryCount) {
                        return;
                    }

                    retryNum += 1;

                    handle();
                    schedule();
                },
                timeout,
            );
        }
    });
}

export { handleWithRetry }
