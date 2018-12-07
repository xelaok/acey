const _ = require("lodash")

const options = {
    base: {
        compile: {
            node: "10",
        },
    },
    debug: {
        buildDir: "dev",
        bundle: {
            sourceMap: false,
        },
    },
    release: {
        buildDir: "dev",
        bundle: {
            sourceMap: false,
        },
    },
    production: {
        buildDir: "prod",
        bundle: {
            sourceMap: false,
        },
    },
}

module.exports = function get(name) {
    return _.merge(options["base"], options[name]);
}
