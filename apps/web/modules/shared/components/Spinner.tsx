import { Loading03Icon } from "@hugeicons/core-free-icons";
import { cn } from "@ui/lib";
import { Icon } from "./Icon";

export function Spinner({ className }: { className?: string }) {
	return (
		<Icon
			icon={Loading03Icon}
			size={16}
			className={cn("animate-spin text-primary", className)}
		/>
	);
}
