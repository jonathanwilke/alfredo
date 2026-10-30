"use client";

import { ProgressProvider } from "@bprogress/next/app";
import type { PropsWithChildren } from "react";

export function NavigationProgress({ children }: PropsWithChildren) {
	return (
		<ProgressProvider
			height="2px"
			color="var(--accent)"
			options={{ showSpinner: false }}
			shallowRouting
		>
			{children}
		</ProgressProvider>
	);
}
