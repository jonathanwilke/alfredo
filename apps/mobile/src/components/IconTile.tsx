import { Image, View } from "react-native";
import type { IconStatus } from "@/api/types";
import { useTheme } from "@/theme/theme";
import { radii } from "@/theme/tokens";

export function IconTile({
	status,
	url,
	label,
	size = 64,
}: {
	status: IconStatus;
	url?: string | null;
	label: string;
	size?: number;
}) {
	const { colors } = useTheme();
	const ready = status === "ready" && url;
	return (
		<View
			accessible={!ready}
			accessibilityLabel={ready ? undefined : label}
			style={{
				width: size,
				height: size,
				borderRadius: radii.icon,
				borderWidth: 1,
				borderColor: colors.border,
				backgroundColor: colors.muted,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{ready ? (
				<Image
					source={{ uri: url }}
					accessibilityLabel={label}
					accessibilityIgnoresInvertColors
					style={{ width: "100%", height: "100%" }}
				/>
			) : (
				<View
					style={{
						width: size * 0.42,
						height: size * 0.42,
						borderRadius: size,
						backgroundColor:
							status === "failed" ? colors.danger : colors.accent,
						opacity: status === "failed" ? 0.3 : 1,
					}}
				/>
			)}
		</View>
	);
}

export function DishImage({
	status,
	url,
	label,
}: {
	status: IconStatus;
	url?: string | null;
	label: string;
}) {
	const { colors } = useTheme();
	const ready = status === "ready" && url;
	return (
		<View
			accessibilityRole="image"
			accessibilityLabel={label}
			style={{
				width: "100%",
				aspectRatio: 16 / 9,
				borderRadius: radii.icon,
				backgroundColor: colors.muted,
				overflow: "hidden",
				alignItems: "center",
				justifyContent: "center",
				shadowColor: "#40442A",
				shadowOffset: { width: 0, height: 14 },
				shadowOpacity: 0.28,
				shadowRadius: 18,
				elevation: 3,
			}}
		>
			{ready ? (
				<Image
					source={{ uri: url }}
					accessibilityIgnoresInvertColors
					style={{ width: "100%", height: "100%" }}
				/>
			) : (
				<View
					style={{
						width: 96,
						height: 96,
						borderRadius: 96,
						backgroundColor:
							status === "failed" ? colors.danger : colors.accent,
						opacity: status === "failed" ? 0.3 : 1,
					}}
				/>
			)}
		</View>
	);
}
