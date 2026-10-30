"use client";

import { authClient } from "@repo/auth/client";
import { vemetric } from "@vemetric/web";
import { useEffect, useRef } from "react";

export function AnalyticsUser() {
	const { data: session, isPending } = authClient.useSession();
	const identified = useRef<string | null>(null);
	const userId = session?.user.id;

	useEffect(() => {
		if (isPending) {
			return;
		}
		if (!userId) {
			if (identified.current) {
				identified.current = null;
				void vemetric.resetUser();
			}
			return;
		}
		if (identified.current === userId) {
			return;
		}
		identified.current = userId;
		void vemetric.identify({ identifier: userId });
	}, [isPending, userId]);

	return null;
}
