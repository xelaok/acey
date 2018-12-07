const path = require("path");
const CleanPlugin = require("clean-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const getBuildConfig = require("./build-config");

module.exports = function ({ buildMode }) {
    console.log("build mode: " + buildMode)

    const buildConfig = getBuildConfig(buildMode)
    const config = getConfig(buildConfig)

    return config
}

function getConfig(buildConfig) {
    const buildPath = `./build/${ buildConfig.buildDir }`;

    return {
        mode: "none",
        target: "node",
        externals: nodeExternals(),
        devtool: buildConfig.bundle.sourceMap,
        entry: {
            index: "./src/index.ts",
        },
        output: {
            path: path.resolve(buildPath),
            filename: "[name].js",
        },
        resolve: {
            extensions: [".js", ".ts", ".tsx"],
            alias: {
              "@@libs": path.resolve("src/libs"),
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "babel-loader",
                            options: {
                                presets: [
                                    ["@babel/env", {
                                        loose: true,
                                        modules: false,
                                        targets: {
                                            node: buildConfig.compile.node,
                                        },
                                    }],
                                ],
                                plugins: [
                                    ["@babel/transform-runtime"],
                                ],
                            },
                        },
                        {
                            loader: "ts-loader",
                        },
                    ],
                },
            ],
        },
        plugins: defineList([
            new CleanPlugin(
                [buildPath],
                { verbose: false }
            ),
        ]),
    }
}

function defineList(list) {
    return list.filter(x => !!x);
}
