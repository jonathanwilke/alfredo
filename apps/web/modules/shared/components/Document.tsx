import { config } from "@repo/config";
import { cn } from "@ui/lib";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

const gambarino = localFont({
	src: [
		{
			path: "../fonts/Gambarino-Regular.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "../fonts/Gambarino-Regular.woff2",
			weight: "500",
			style: "normal",
		},
		{
			path: "../fonts/Gambarino-Regular.woff2",
			weight: "600",
			style: "normal",
		},
		{
			path: "../fonts/Gambarino-Regular.woff2",
			weight: "700",
			style: "normal",
		},
	],
	variable: "--font-gambarino",
	display: "swap",
});

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	display: "swap",
});

export function Document({
	children,
	locale,
}: PropsWithChildren<{ locale: string }>) {
	return (
		<html
			lang={locale}
			className={cn(gambarino.variable, inter.variable)}
			suppressHydrationWarning
		>
			<body className="min-h-screen bg-background text-body antialiased">
				<ThemeProvider
					attribute="class"
					disableTransitionOnChange
					enableSystem
					defaultTheme={config.ui.defaultTheme}
					themes={config.ui.enabledThemes}
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
