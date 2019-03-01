const _ = require("lodash");

const options = {
    base: {
        compile: {
            node: "current",
        },
    },
    debug: {
        buildDir: "dev",
        bundle: {
            sourceMap: false,
            moduleConcatenation: false,
        },
    },
    release: {
        buildDir: "dev",
        bundle: {
            sourceMap: false,
            moduleConcatenation: true,
        },
    },
    production: {
        buildDir: "prod",
        bundle: {
            sourceMap: false,
            moduleConcatenation: true,
        },
    },
};

module.exports = function get(name) {
    return _.merge(options["base"], options[name]);
}
