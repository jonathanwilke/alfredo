"use client";

import { RecipeLinkForm } from "@shared/components/RecipeLinkForm";
import { useState } from "react";
import { BillingSection } from "./BillingSection";

export function HomeImport() {
	const [openPaywallToken, setOpenPaywallToken] = useState(0);

	return (
		<div className="flex flex-col gap-8">
			<RecipeLinkForm
				onQuotaExceeded={() =>
					setOpenPaywallToken((value) => value + 1)
				}
			/>
			<BillingSection openPaywallToken={openPaywallToken} />
		</div>
	);
}
