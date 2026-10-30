import "react-native-gesture-handler";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { PTSerif_400Regular } from "@expo-google-fonts/pt-serif/400Regular";
import { PTSerif_700Bold } from "@expo-google-fonts/pt-serif/700Bold";
import * as Device from "expo-device";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Dimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider, useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { ThemeProvider, useTheme } from "@/theme/theme";

WebBrowser.maybeCompleteAuthSession();
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<I18nProvider>
					<RootNavigator />
				</I18nProvider>
			</ThemeProvider>
		</SafeAreaProvider>
	);
}

function RootNavigator() {
	const { colors, scheme, ready: themeReady } = useTheme();
	const { ready: localeReady } = useI18n();
	const [fontsLoaded, fontError] = useFonts({
		Inter_400Regular,
		Inter_600SemiBold,
		PTSerif_400Regular,
		PTSerif_700Bold,
	});
	const ready =
		(fontsLoaded || Boolean(fontError)) && themeReady && localeReady;
	useOrientation();

	useEffect(() => {
		void SystemUI.setBackgroundColorAsync(colors.background);
	}, [colors.background]);

	useEffect(() => {
		if (ready) {
			void SplashScreen.hideAsync();
		}
	}, [ready]);

	if (!ready) {
		return null;
	}

	return (
		<>
			<StatusBar style={scheme === "dark" ? "light" : "dark"} />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: colors.background },
					animation: "slide_from_right",
				}}
			/>
		</>
	);
}

function useOrientation() {
	const { isTablet } = useLayout();
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const type = await Device.getDeviceTypeAsync();
			if (cancelled) {
				return;
			}
			const window = Dimensions.get("window");
			const shortest = Math.min(window.width, window.height);
			const tablet =
				type === Device.DeviceType.TABLET ||
				isTablet ||
				shortest >= 600;
			await ScreenOrientation.lockAsync(
				tablet
					? ScreenOrientation.OrientationLock.DEFAULT
					: ScreenOrientation.OrientationLock.PORTRAIT_UP,
			);
		})();
		return () => {
			cancelled = true;
		};
	}, [isTablet]);
}
