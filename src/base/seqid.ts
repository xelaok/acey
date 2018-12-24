function createSeqIdGenerator(): () => number {
    let counter = 0;
    return () => ++counter;
}

export { createSeqIdGenerator }
