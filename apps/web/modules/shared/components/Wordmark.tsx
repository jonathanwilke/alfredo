import { cn } from "@ui/lib";

export function Wordmark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 250 56"
			role="img"
			aria-label="ulivo"
			className={cn("h-10 w-auto text-foreground", className)}
		>
			<ellipse
				cx="16"
				cy="32"
				rx="9"
				ry="14"
				transform="rotate(-22 16 32)"
				className="fill-[#3d562e] dark:fill-[#9aaa62]"
			/>
			<ellipse
				cx="13"
				cy="27"
				rx="2.5"
				ry="3.5"
				transform="rotate(-22 13 27)"
				className="fill-[#e4e6c4] dark:fill-[#1a1d14]"
			/>
			<ellipse
				cx="36"
				cy="30"
				rx="9"
				ry="14"
				transform="rotate(16 36 30)"
				className="fill-[#93a65c] dark:fill-[#d4e28d]"
			/>
			<ellipse
				cx="33"
				cy="25"
				rx="2.5"
				ry="3.5"
				transform="rotate(16 33 25)"
				className="fill-[#e4e6c4] dark:fill-[#1a1d14]"
			/>
			<text
				x="56"
				y="44"
				fontSize="42"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="1.2"
				className="font-heading"
				style={{ paintOrder: "stroke fill" }}
			>
				ulivo
			</text>
		</svg>
	);
}
