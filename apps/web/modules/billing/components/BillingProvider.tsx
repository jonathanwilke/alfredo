"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import { BuyCreditsDialog } from "./BuyCreditsDialog";

type Reason = "buy" | "empty";

const BillingContext = createContext<{
	openBuy: () => void;
	openEmpty: () => void;
} | null>(null);

export function useBilling() {
	const value = useContext(BillingContext);
	if (!value) {
		throw new Error("BillingProvider missing");
	}
	return value;
}

export function BillingProvider({ children }: { children: ReactNode }) {
	const [reason, setReason] = useState<Reason | null>(null);
	const value = useMemo(
		() => ({
			openBuy: () => setReason("buy"),
			openEmpty: () => setReason("empty"),
		}),
		[],
	);

	return (
		<BillingContext.Provider value={value}>
			{children}
			<BuyCreditsDialog reason={reason} onClose={() => setReason(null)} />
		</BillingContext.Provider>
	);
}
