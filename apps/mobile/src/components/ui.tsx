import type { ComponentRef, ReactNode, Ref } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	type TextInputProps,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { fonts, radii } from "@/theme/tokens";

export function Screen({
	children,
	edges = ["top", "left", "right"],
	style,
}: {
	children: ReactNode;
	edges?: Edge[];
	style?: ViewStyle;
}) {
	const { colors } = useTheme();
	return (
		<SafeAreaView
			edges={edges}
			style={[
				styles.screen,
				{ backgroundColor: colors.background },
				style,
			]}
		>
			{children}
		</SafeAreaView>
	);
}

export function Display({
	children,
	size,
	center,
}: {
	children: ReactNode;
	size: number;
	center?: boolean;
}) {
	const { colors } = useTheme();
	return (
		<Text
			style={{
				fontFamily: fonts.display,
				fontSize: size,
				lineHeight: Math.round(size * 1.05),
				color: colors.foreground,
				textAlign: center ? "center" : "left",
			}}
		>
			{children}
		</Text>
	);
}

export function Body({
	children,
	center,
	muted,
	size = 18,
	style,
}: {
	children: ReactNode;
	center?: boolean;
	muted?: boolean;
	size?: number;
	style?: TextStyle;
}) {
	const { colors } = useTheme();
	return (
		<Text
			style={[
				{
					fontFamily: fonts.body,
					fontSize: size,
					lineHeight: Math.round(size * 1.45),
					color: muted ? colors.mutedForeground : colors.body,
					textAlign: center ? "center" : "left",
				},
				style,
			]}
		>
			{children}
		</Text>
	);
}

export function Button({
	label,
	onPress,
	variant = "primary",
	loading,
	disabled,
	icon,
	tall,
	style,
}: {
	label: string;
	onPress: () => void;
	variant?: "primary" | "outline" | "ghost";
	loading?: boolean;
	disabled?: boolean;
	icon?: ReactNode;
	tall?: boolean;
	style?: ViewStyle;
}) {
	const { colors } = useTheme();
	const filled = variant === "primary";
	const backgroundColor = filled ? colors.accent : "transparent";
	const color = filled ? colors.accentForeground : colors.foreground;
	const borderColor = variant === "outline" ? colors.border : "transparent";
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled || loading}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				tall ? styles.buttonTall : null,
				{
					backgroundColor,
					borderColor,
					opacity: disabled ? 0.55 : pressed ? 0.86 : 1,
				},
				style,
			]}
		>
			{loading ? (
				<ActivityIndicator color={color} />
			) : (
				<View style={styles.buttonRow}>
					{icon}
					<Text style={[styles.buttonLabel, { color }]}>{label}</Text>
				</View>
			)}
		</Pressable>
	);
}

export function IconButton({
	label,
	onPress,
	children,
}: {
	label: string;
	onPress: () => void;
	children: ReactNode;
}) {
	const { colors } = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			hitSlop={8}
			style={({ pressed }) => [
				styles.iconButton,
				{ opacity: pressed ? 0.7 : 1, borderColor: colors.border },
			]}
		>
			{children}
		</Pressable>
	);
}

export function Field({
	label,
	value,
	onChangeText,
	invalid,
	icon,
	ref,
	...props
}: {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	invalid?: boolean;
	icon?: ReactNode;
	ref?: Ref<ComponentRef<typeof TextInput>>;
} & Omit<TextInputProps, "value" | "onChangeText">) {
	const { colors } = useTheme();
	return (
		<View style={styles.fieldWrap}>
			{icon ? <View style={styles.fieldIcon}>{icon}</View> : null}
			<TextInput
				{...props}
				ref={ref}
				accessibilityLabel={label}
				value={value}
				onChangeText={onChangeText}
				placeholderTextColor={colors.mutedForeground}
				autoCapitalize={props.autoCapitalize ?? "none"}
				style={[
					styles.field,
					{
						backgroundColor: colors.card,
						borderColor: invalid ? colors.danger : colors.input,
						color: colors.foreground,
						paddingLeft: icon ? 48 : 20,
					},
				]}
			/>
		</View>
	);
}

export function Notice({
	children,
	tone = "muted",
}: {
	children: ReactNode;
	tone?: "muted" | "danger";
}) {
	const { colors } = useTheme();
	return (
		<Text
			accessibilityRole={tone === "danger" ? "alert" : "text"}
			style={{
				fontFamily: fonts.body,
				fontSize: 16,
				lineHeight: 22,
				color:
					tone === "danger" ? colors.danger : colors.mutedForeground,
			}}
		>
			{children}
		</Text>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	button: {
		minHeight: 48,
		borderRadius: radii.pill,
		borderWidth: 1,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
	},
	buttonTall: {
		minHeight: 64,
	},
	buttonRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	buttonLabel: {
		fontFamily: fonts.label,
		fontSize: 18,
	},
	iconButton: {
		width: 44,
		height: 44,
		borderRadius: radii.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	fieldWrap: {
		flex: 1,
		minWidth: 0,
		justifyContent: "center",
	},
	fieldIcon: {
		position: "absolute",
		left: 16,
		zIndex: 1,
	},
	field: {
		height: 48,
		borderRadius: radii.pill,
		borderWidth: 1,
		paddingRight: 20,
		fontFamily: fonts.body,
		fontSize: 18,
	},
});
