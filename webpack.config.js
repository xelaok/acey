const path = require("path");
const webpack = require("webpack");
const CleanPlugin = require("clean-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const ForkTsCheckerPlugin = require("fork-ts-checker-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const getBuildConfig = require("./build-config");
const pkg = require("./package.json");

module.exports = function ({ buildMode }) {
    console.log(`build mode: ${buildMode}`);
    return getConfig(getBuildConfig(buildMode));
};

function getConfig(buildConfig) {
    const buildPath = `./build/${buildConfig.buildDir}`;

    return {
        mode: "none",
        target: "node",
        externals: nodeExternals(),
        devtool: buildConfig.bundle.sourceMap,
        node: {
            __dirname: false,
        },
        entry: {
            index: "./src/index.ts",
        },
        output: {
            path: path.resolve(buildPath),
            filename: "[name].js",
        },
        resolve: {
            extensions: [".js", ".ts"],
            alias: {},
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "babel-loader",
                            options: {
                                cacheDirectory: true,
                                presets: [
                                    ["@babel/env", {
                                        loose: true,
                                        modules: false,
                                        targets: {
                                            node: buildConfig.target.node,
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
                            options: {
                                transpileOnly: true,
                            },
                        },
                    ],
                },
            ],
        },
        optimization: {
            minimize: buildConfig.bundle.beautify,
            concatenateModules: buildConfig.bundle.moduleConcatenation,
            usedExports: true,
            sideEffects: true,
            minimizer: [
                new TerserPlugin({
                    parallel: true,
                    sourceMap: true,
                    terserOptions: {
                        mangle: false,
                        compress: false,
                        output: {
                            beautify: true,
                            comments: false,
                        },
                    },
                }),
            ],
        },
        plugins: [
            new CleanPlugin({ verbose: false }),
            new webpack.DefinePlugin({
                "process.env.appVersion": JSON.stringify(pkg.version),
            }),
            buildConfig.tsCheck && new ForkTsCheckerPlugin(),
        ].filter(p => !!p),
    };
}
