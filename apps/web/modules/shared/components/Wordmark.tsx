import { cn } from "@ui/lib";

const wordmarkType = {
	WebkitTextStroke: "0.7px currentColor",
	paintOrder: "stroke fill",
} as const;

export function Wordmark({ className }: { className?: string }) {
	return (
		<span
			role="img"
			aria-label="ulivo"
			className={cn(
				"inline-flex items-end font-heading text-[1.7rem] leading-none text-foreground",
				className,
			)}
		>
			<span aria-hidden style={wordmarkType}>
				uliv
			</span>
			<svg
				aria-hidden
				viewBox="0 0 40 42"
				className="mb-[0.06em] ml-[0.04em] h-[1.12em] w-auto overflow-visible"
			>
				<path
					d="M22.5 17.5 L35.5 2.5"
					className="stroke-accent"
					strokeWidth="4.6"
					strokeLinecap="round"
				/>
				<ellipse
					cx="15"
					cy="27"
					rx="12"
					ry="13"
					className="fill-[#859438] dark:fill-[#96a84f]"
				/>
				<ellipse
					cx="12.4"
					cy="24.2"
					rx="2.15"
					ry="3.2"
					transform="rotate(-18 12.4 24.2)"
					className="fill-[#e4e6c4] dark:fill-[#1a1d14]"
				/>
			</svg>
		</span>
	);
}
