import { cn } from "@ui/lib";

export function Wordmark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 250 56"
			role="img"
			aria-label="ulivo"
			className={cn("h-9 w-auto text-foreground", className)}
		>
			<path
				d="M16.5 16.5c-1.4 3.4-1.8 6.2-1.2 9.4C9.4 28.2 6 33.6 6 39.4V42h40v-2.6c0-5.8-3.4-11.2-9.3-13.5.6-3.2.2-6-1.2-9.4-1.4-3.2-4.4-5.2-7.6-5.4-3.4-.2-6.4 1.8-7.4 5.4z"
				className="fill-[#859438] dark:fill-[#96a84f]"
			/>
			<path
				d="M23.2 18.2c.6 4.4.4 11-.4 17.2h6.6c-.8-6.2-1-12.8-.4-17.2-1.2-2.4-4.6-2.4-5.8 0z"
				className="fill-accent"
			/>
			<path
				d="M5 39.5h42v5.2c0 2.4-1.9 4.3-4.3 4.3H9.3c-2.4 0-4.3-1.9-4.3-4.3v-5.2z"
				className="fill-accent"
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
