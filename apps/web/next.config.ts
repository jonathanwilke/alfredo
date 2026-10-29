import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

loadEnvConfig(path.join(__dirname, "../.."));

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

const nextConfig: NextConfig = {
	outputFileTracingRoot: path.join(__dirname, "../../"),
	transpilePackages: [
		"@repo/api",
		"@repo/auth",
		"@repo/ai",
		"@repo/config",
		"@repo/database",
		"@repo/i18n",
		"@repo/icons",
		"@repo/payments",
		"@repo/storage",
	],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
		],
	},
	webpack: (config, { webpack }) => {
		config.plugins.push(
			new webpack.IgnorePlugin({
				resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
			}),
		);

		return config;
	},
};

export default withNextIntl(nextConfig);
