export type Scheme = "light" | "dark";

export type Palette = {
	background: string;
	foreground: string;
	body: string;
	muted: string;
	mutedForeground: string;
	border: string;
	input: string;
	accent: string;
	accentForeground: string;
	card: string;
	popover: string;
	timer: string;
	danger: string;
	leaf: string;
	ring: string;
};

export const palettes: Record<Scheme, Palette> = {
	light: {
		background: "#F3EDE3",
		foreground: "#40442A",
		body: "#5C584C",
		muted: "#F6F9E8",
		mutedForeground: "#6A655A",
		border: "#E4D9C8",
		input: "#D9CDB8",
		accent: "#8E9C4A",
		accentForeground: "#FFFFFF",
		card: "#FFFFFF",
		popover: "#F8F4EE",
		timer: "#DC6416",
		danger: "#8C2F24",
		leaf: "#8E9C4A",
		ring: "#6A7147",
	},
	dark: {
		background: "#1A1D14",
		foreground: "#F3EDE3",
		body: "#E7E0D4",
		muted: "#24281C",
		mutedForeground: "#C8C2B4",
		border: "#3A4030",
		input: "#4A5240",
		accent: "#C3D56D",
		accentForeground: "#1A1D14",
		card: "#24281C",
		popover: "#2C3224",
		timer: "#F0943A",
		danger: "#E7B2A8",
		leaf: "#C3D56D",
		ring: "#C3D56D",
	},
};

export const radii = {
	pill: 999,
	icon: 28,
	md: 12,
} as const;

export const space = {
	page: 20,
	pageTablet: 32,
	stack: 32,
} as const;

export const control = {
	field: 48,
	cooking: 64,
} as const;

export const fonts = {
	body: "Inter_400Regular",
	label: "Inter_600SemiBold",
	display: "PTSerif_700Bold",
	displayRegular: "PTSerif_400Regular",
} as const;
