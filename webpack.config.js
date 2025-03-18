const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
	entry: {
		popup: "./src/popup/index.tsx",
		background: "./src/background/index.ts",
		content: "./src/content/index.ts",
	},
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "[name].js",
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
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".jsx"],
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
};
