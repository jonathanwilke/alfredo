"use client";

import { vemetric } from "@vemetric/web";

export function track(
	name: string,
	eventData?: Record<string, string | number | boolean>,
) {
	void vemetric.trackEvent(name, eventData ? { eventData } : undefined);
}
