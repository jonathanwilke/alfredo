import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
	name: "ulivo",
	slug: "ulivo",
	scheme: "ulivo",
	version: "1.0.0",
	orientation: "default",
	icon: "./assets/icon.png",
	userInterfaceStyle: "automatic",
	backgroundColor: "#F3EDE3",
	ios: {
		supportsTablet: true,
		bundleIdentifier: "app.ulivo.mobile",
		infoPlist: {
			UISupportedInterfaceOrientations: [
				"UIInterfaceOrientationPortrait",
			],
			NSUserNotificationsUsageDescription:
				"ulivo alerts you when a cooking timer finishes, including while the app is in the background.",
			"UISupportedInterfaceOrientations~ipad": [
				"UIInterfaceOrientationPortrait",
				"UIInterfaceOrientationPortraitUpsideDown",
				"UIInterfaceOrientationLandscapeLeft",
				"UIInterfaceOrientationLandscapeRight",
			],
		},
	},
	android: {
		package: "app.ulivo.mobile",
		adaptiveIcon: {
			foregroundImage: "./assets/icon.png",
			backgroundColor: "#F3EDE3",
		},
	},
	plugins: [
		"expo-router",
		"expo-status-bar",
		"expo-secure-store",
		"expo-font",
		"expo-localization",
		"expo-web-browser",
		"expo-screen-orientation",
		[
			"expo-notifications",
			{
				enableRemoteNotifications: false,
				color: "#C3D56D",
			},
		],
		[
			"expo-splash-screen",
			{
				backgroundColor: "#F3EDE3",
				image: "./assets/icon.png",
				imageWidth: 180,
			},
		],
	],
	experiments: {
		typedRoutes: false,
	},
};

export default config;
