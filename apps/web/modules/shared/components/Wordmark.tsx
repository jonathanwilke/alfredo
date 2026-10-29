import { ChefHatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@ui/lib";

export function Wordmark({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex h-9 items-center gap-1.5 text-foreground",
				className,
			)}
		>
			<HugeiconsIcon
				icon={ChefHatIcon}
				size={30}
				color="currentColor"
				strokeWidth={1.5}
				aria-hidden
				className="shrink-0 text-[#859438] dark:text-[#96a84f]"
			/>
			<span
				className="font-heading text-[1.7rem] leading-none"
				style={{
					WebkitTextStroke: "0.7px currentColor",
					paintOrder: "stroke fill",
				}}
			>
				ulivo
			</span>
		</span>
	);
}
