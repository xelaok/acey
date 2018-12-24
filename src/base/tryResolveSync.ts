function tryResolveSync<T>(
    value: any,
    handler: (result: any) => T | Promise<T>
): T | Promise<T> {
    if (!value || !value['then']) {
        return handler(value)
    }

    if (value['isFulfilled'] && value.isFulfilled()) {
        return handler(value.value())
    }

    return value.then(handler)
}

export {
    tryResolveSync,
}
