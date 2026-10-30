"use client";

import { useRouter as useProgressRouter } from "@bprogress/next/app";
import { useNextIntlRouter } from "./routing";

export function useLocaleRouter() {
	return useProgressRouter({
		customRouter: useNextIntlRouter,
	});
}
