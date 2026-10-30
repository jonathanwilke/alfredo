import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

export function Icon({
	size = 20,
	strokeWidth = 1.5,
	color = "currentColor",
	...props
}: HugeiconsIconProps) {
	return (
		<HugeiconsIcon
			size={size}
			strokeWidth={strokeWidth}
			color={color}
			{...props}
		/>
	);
}
