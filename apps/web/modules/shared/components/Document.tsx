import { config } from "@repo/config";
import { cn } from "@ui/lib";
import { Inter, PT_Serif } from "next/font/google";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

const ptSerif = PT_Serif({
	subsets: ["latin"],
	weight: ["400", "700"],
	variable: "--font-pt-serif",
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
			className={cn(ptSerif.variable, inter.variable)}
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
