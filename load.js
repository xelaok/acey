function load(buildName) {
    const path = tryResolveModule("./build/" + buildName);

    if (!path) {
        console.error("Build not found. Use `npm i && npm run dist` to build the project.");
        return;
    }

    require(path);
}

function tryResolveModule(request) {
    try {
        return require.resolve(request);
    }
    catch (err) {
        return null;
    }
}

module.exports = load;
