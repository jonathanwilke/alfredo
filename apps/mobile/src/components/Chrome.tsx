import { usePathname, useRouter } from "expo-router";
import { Bookmark, Coins, LogOut, Moon, Sun, User } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import {
	Linking,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authClient } from "@/auth/client";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";
import { IconButton } from "./ui";
import { Wordmark } from "./Wordmark";

export function Header({ home }: { home?: boolean }) {
	const { colors, scheme, toggle } = useTheme();
	const { copy } = useI18n();
	const { data: session, isPending } = authClient.useSession();
	const pathname = usePathname();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { pagePadding } = useLayout();
	const [open, setOpen] = useState(false);

	const loginHref =
		pathname === "/login"
			? "/login"
			: (`/login?next=${encodeURIComponent(pathname || "/")}` as const);

	return (
		<View style={[styles.header, { paddingHorizontal: pagePadding }]}>
			<Pressable
				accessibilityRole="link"
				accessibilityLabel="ulivo"
				onPress={() => {
					if (!home) {
						router.push("/");
					}
				}}
			>
				<Wordmark />
			</Pressable>
			<View style={styles.actions}>
				{isPending ? <View style={styles.loginSpacer} /> : null}
				{!isPending && session ? (
					<IconButton
						label={copy.home.account}
						onPress={() => setOpen(true)}
					>
						<User color={colors.foreground} size={20} />
					</IconButton>
				) : null}
				{!isPending && !session ? (
					<Pressable
						accessibilityRole="button"
						onPress={() => router.push(loginHref)}
						style={[styles.login, { borderColor: colors.border }]}
					>
						<Text
							style={[
								styles.loginLabel,
								{ color: colors.foreground },
							]}
						>
							{copy.home.login}
						</Text>
					</Pressable>
				) : null}
				<IconButton label={copy.home.theme} onPress={toggle}>
					{scheme === "dark" ? (
						<Sun color={colors.foreground} size={20} />
					) : (
						<Moon color={colors.foreground} size={20} />
					)}
				</IconButton>
			</View>
			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<Pressable
					style={styles.backdrop}
					onPress={() => setOpen(false)}
				>
					<View
						style={[
							styles.menu,
							{
								top: insets.top + 64,
								right: pagePadding,
								backgroundColor: colors.popover,
								borderColor: colors.border,
							},
						]}
					>
						<MenuItem
							label={copy.home.recipeCredits}
							icon={<Coins color={colors.foreground} size={20} />}
							onPress={() => {
								setOpen(false);
								router.push("/credits");
							}}
						/>
						<MenuItem
							label={copy.home.savedRecipes}
							icon={
								<Bookmark color={colors.foreground} size={20} />
							}
							onPress={() => {
								setOpen(false);
								router.push("/saved");
							}}
						/>
						<MenuItem
							label={copy.home.logout}
							icon={
								<LogOut color={colors.foreground} size={20} />
							}
							onPress={() => {
								setOpen(false);
								void authClient.signOut();
							}}
						/>
					</View>
				</Pressable>
			</Modal>
		</View>
	);
}

function MenuItem({
	label,
	icon,
	onPress,
}: {
	label: string;
	icon: ReactNode;
	onPress: () => void;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			accessibilityRole="menuitem"
			onPress={onPress}
			style={({ pressed }) => [
				styles.menuItem,
				{ backgroundColor: pressed ? colors.muted : "transparent" },
			]}
		>
			{icon}
			<Text style={[styles.menuLabel, { color: colors.foreground }]}>
				{label}
			</Text>
		</Pressable>
	);
}

export function Footer() {
	const { colors } = useTheme();
	const { locale, setLocale, copy } = useI18n();
	return (
		<View style={styles.footer}>
			<Text style={[styles.built, { color: colors.mutedForeground }]}>
				{copy.footer.builtBy}{" "}
				<Text
					accessibilityRole="link"
					onPress={() => {
						void Linking.openURL("https://x.com/jonathan_wilke");
					}}
					style={{ color: colors.foreground }}
				>
					@jonathan_wilke
				</Text>
			</Text>
			<View
				accessibilityRole="tablist"
				accessibilityLabel={copy.footer.language}
				style={styles.locales}
			>
				{(["de", "en"] as const).map((code, index) => (
					<View key={code} style={styles.localeRow}>
						{index > 0 ? (
							<Text style={{ color: colors.mutedForeground }}>
								{" "}
								·{" "}
							</Text>
						) : null}
						<Pressable
							accessibilityRole="tab"
							accessibilityState={{ selected: locale === code }}
							onPress={() => setLocale(code)}
						>
							<Text
								style={{
									fontFamily: fonts.body,
									fontSize: 13,
									color:
										locale === code
											? colors.foreground
											: colors.mutedForeground,
								}}
							>
								{code === "de" ? "Deutsch" : "English"}
							</Text>
						</Pressable>
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		minHeight: 56,
		paddingHorizontal: 20,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
	},
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	login: {
		height: 44,
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	loginLabel: {
		fontFamily: fonts.label,
		fontSize: 16,
	},
	loginSpacer: {
		width: 88,
		height: 44,
	},
	backdrop: {
		flex: 1,
	},
	menu: {
		position: "absolute",
		width: 232,
		borderRadius: 24,
		borderWidth: 1,
		padding: 8,
	},
	menuItem: {
		minHeight: 48,
		borderRadius: 999,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	menuLabel: {
		fontFamily: fonts.body,
		fontSize: 16,
	},
	footer: {
		alignItems: "center",
		paddingTop: 24,
		paddingBottom: 16,
		gap: 8,
	},
	built: {
		fontFamily: fonts.body,
		fontSize: 14,
	},
	locales: {
		flexDirection: "row",
		alignItems: "center",
	},
	localeRow: {
		flexDirection: "row",
		alignItems: "center",
	},
});
