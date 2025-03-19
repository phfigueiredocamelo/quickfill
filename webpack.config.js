const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const { optimize } = require("webpack");

// Create separate configurations for each entry point
const createConfig = (name, entry, isServiceWorker = false) => ({
	name,
	target: isServiceWorker ? 'webworker' : 'web',
	entry: { [name]: entry },
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js",
	},
	optimization: {
		chunkIds: "named",
		minimize: false,
		splitChunks: isServiceWorker ? false : {
			chunks: 'all',
		},
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx|js|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: "babel-loader",
					options: {
						presets: [
							"@babel/preset-env",
							"@babel/preset-react",
							"@babel/preset-typescript",
						],
					},
				},
			},
			{
				test: /\.css$/,
				use: ["style-loader", "css-loader"],
			},
		],
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".jsx"],
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});

// Main popup config with HTML plugin and shared plugins
const popupConfig = {
	...createConfig('popup', './src/popup/index.tsx'),
	plugins: [
		new HtmlWebpackPlugin({
			template: "./src/popup/index.html",
			filename: "popup.html",
			chunks: ["popup"],
		}),
		new CopyPlugin({
			patterns: [
				{ from: "public", to: "." },
				{ from: "manifest.json", to: "." },
			],
		}),
	],
};

// Background service worker config
const backgroundConfig = {
	...createConfig('background', './src/background/index.ts', true),
	// Force no code splitting and all dependencies to be bundled in one file
	optimization: {
		chunkIds: "named",
		minimize: false,
		splitChunks: false,
		runtimeChunk: false,
	},
};

// Content script config
const contentConfig = createConfig('content', './src/content/index.ts');

// Export array of configurations
module.exports = [popupConfig, backgroundConfig, contentConfig];