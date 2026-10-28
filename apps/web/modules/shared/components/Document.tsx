import { config } from "@repo/config";
import { cn } from "@ui/lib";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

const fraunces = Fraunces({
	subsets: ["latin"],
	weight: ["500", "600"],
	variable: "--font-fraunces",
	display: "swap",
	adjustFontFallback: true,
});

const sourceSans = Source_Sans_3({
	subsets: ["latin"],
	weight: ["400", "600"],
	variable: "--font-source-sans",
	display: "swap",
	adjustFontFallback: true,
});

export function Document({
	children,
	locale,
}: PropsWithChildren<{ locale: string }>) {
	return (
		<html
			lang={locale}
			className={cn(fraunces.variable, sourceSans.variable)}
			suppressHydrationWarning
		>
			<body className="min-h-screen bg-background text-foreground antialiased">
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
