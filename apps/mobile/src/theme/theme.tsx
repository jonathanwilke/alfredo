import * as SecureStore from "expo-secure-store";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useColorScheme } from "react-native";
import { type Palette, palettes, type Scheme } from "./tokens";

const STORAGE_KEY = "ulivo.theme";

type Preference = Scheme | "system";

type ThemeValue = {
	scheme: Scheme;
	colors: Palette;
	ready: boolean;
	toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const system = useColorScheme();
	const [preference, setPreference] = useState<Preference>("light");
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void SecureStore.getItemAsync(STORAGE_KEY)
			.then((stored) => {
				if (cancelled) {
					return;
				}
				if (
					stored === "light" ||
					stored === "dark" ||
					stored === "system"
				) {
					setPreference(stored);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setReady(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const scheme: Scheme =
		preference === "system"
			? system === "dark"
				? "dark"
				: "light"
			: preference;

	const toggle = useCallback(() => {
		setPreference((current) => {
			const resolved =
				current === "system"
					? system === "dark"
						? "dark"
						: "light"
					: current;
			const next: Scheme = resolved === "dark" ? "light" : "dark";
			void SecureStore.setItemAsync(STORAGE_KEY, next);
			return next;
		});
	}, [system]);

	const value = useMemo<ThemeValue>(
		() => ({
			scheme,
			colors: palettes[scheme],
			ready,
			toggle,
		}),
		[scheme, ready, toggle],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const value = useContext(ThemeContext);
	if (!value) {
		throw new Error("ThemeProvider missing");
	}
	return value;
}
