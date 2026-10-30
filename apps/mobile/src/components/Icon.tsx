import { HugeiconsIcon, type HugeiconsProps } from "@hugeicons/react-native";

export function Icon({
	size = 20,
	strokeWidth = 1.5,
	...props
}: HugeiconsProps) {
	return <HugeiconsIcon size={size} strokeWidth={strokeWidth} {...props} />;
}
