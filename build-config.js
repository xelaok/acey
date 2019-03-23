const { merge } = require("lodash");

const options = {
    base: {
        targets: {
            node: "current",
        },
    },
    debug: {
        buildDir: "dev",
        devtool: "cheap-module-source-map",
        useCache: true,
        transpileOnly: false,
        beautify: false,
        moduleConcatenation: false,
    },
    release: {
        buildDir: "dev",
        devtool: "source-map",
        useCache: true,
        transpileOnly: false,
        beautify: true,
        moduleConcatenation: true,
    },
    production: {
        buildDir: "prod",
        devtool: "source-map",
        useCache: false,
        transpileOnly: true,
        beautify: true,
        moduleConcatenation: true,
    },
};

module.exports = function get(name) {
    return merge(options["base"], options[name]);
};
