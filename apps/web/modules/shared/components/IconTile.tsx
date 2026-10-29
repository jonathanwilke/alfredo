import { cn } from "@ui/lib";

export function IconTile({
	status,
	url,
	label,
	size = "ingredient",
	decorative = false,
}: {
	status: "pending" | "ready" | "failed";
	url?: string | null;
	label: string;
	size?: "hero" | "ingredient";
	decorative?: boolean;
}) {
	const dimension = size === "hero" ? "size-28" : "size-16";

	return (
		<div
			className={cn(
				"relative shrink-0 overflow-hidden rounded-[1.75rem] border border-border bg-muted",
				dimension,
			)}
			aria-hidden={decorative || undefined}
		>
			{status === "ready" && url ? (
				// biome-ignore lint/performance/noImgElement: icon URLs are stored objects, not next/image assets
				<img
					src={url}
					alt={decorative ? "" : label}
					className="size-full object-cover"
				/>
			) : decorative ? (
				<div className="flex size-full items-center justify-center">
					<span
						className={cn(
							"block rounded-full",
							size === "hero" ? "size-16" : "size-9",
							status === "failed"
								? "bg-destructive/30"
								: "bg-accent",
						)}
					/>
				</div>
			) : (
				<div
					className="flex size-full items-center justify-center"
					role="img"
					aria-label={label}
				>
					<span
						className={cn(
							"block rounded-full",
							size === "hero" ? "size-16" : "size-9",
							status === "failed"
								? "bg-destructive/30"
								: "bg-accent",
						)}
					/>
				</div>
			)}
		</div>
	);
}
