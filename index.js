require("source-map-support").install();
requireBuild();

function requireBuild() {
    if (process.argv[2] === "dev") {
        require("./build/dev");
    }
    else {
        const path = tryResolveModule("./build/prod");

        if (!path) {
            console.error("Build not found. Use `npm i && npm run dist` to build the project.");
            return;
        }

        require(path);
    }
}

function tryResolveModule(request) {
    try {
        return require.resolve(request);
    }
    catch (err) {
        return null;
    }
}
