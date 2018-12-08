function fireAndForget(handler: () => Promise<void>): void {
    handler().catch(err => {
        console.log(err);
    });
}

export { fireAndForget }
