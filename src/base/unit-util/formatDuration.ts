function formatDuration(value: number): string {
    return (value / 1000).toFixed(0) + "s";
}

export { formatDuration }
