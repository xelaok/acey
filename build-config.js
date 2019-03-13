const { merge } = require("lodash");

const options = {
    base: {
        target: {
            node: "current",
        },
    },
    debug: {
        buildDir: "dev",
        tsCheck: true,
        bundle: {
            sourceMap: "cheap-module-source-map",
            beautify: false,
            moduleConcatenation: false,
        },
    },
    release: {
        buildDir: "dev",
        tsCheck: true,
        bundle: {
            sourceMap: "source-map",
            beautify: true,
            moduleConcatenation: true,
        },
    },
    production: {
        buildDir: "prod",
        tsCheck: false,
        bundle: {
            sourceMap: "source-map",
            beautify: true,
            moduleConcatenation: true,
        },
    },
};

module.exports = function get(name) {
    return merge(options["base"], options[name]);
};
