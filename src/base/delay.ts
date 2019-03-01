function delay(time: number): Promise<void> {
    return new Promise(resolve => global.setTimeout(resolve, time));
}

export { delay }
