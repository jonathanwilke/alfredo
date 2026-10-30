import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { api, apiCode } from "@/api/client";
import type { CreditBalance, CreditEntry } from "@/api/types";
import { authClient } from "@/auth/client";
import { Footer, Header } from "@/components/Chrome";
import { Body, Button, Display, Notice, Screen } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";

export default function CreditsScreen() {
	const { copy, locale } = useI18n();
	const { colors } = useTheme();
	const layout = useLayout();
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [balance, setBalance] = useState<CreditBalance | null>(null);
	const [entries, setEntries] = useState<CreditEntry[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		void api
			.balance()
			.then((result) => {
				if (!cancelled) {
					setBalance(result);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setBalance(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [session, attempt]);

	useEffect(() => {
		if (isPending) {
			return;
		}
		if (!session) {
			setEntries([]);
			return;
		}
		let cancelled = false;
		void api
			.history()
			.then((result) => {
				if (!cancelled) {
					setEntries(result);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				if (apiCode(error) === "UNAUTHORIZED") {
					router.replace("/login?next=%2Fcredits");
					return;
				}
				setFailed(true);
				setEntries([]);
			});
		return () => {
			cancelled = true;
		};
	}, [session, isPending, router, attempt]);

	return (
		<Screen>
			<Header />
			<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
				<View
					style={{
						width: "100%",
						maxWidth: layout.isTablet ? 760 : layout.contentWidth,
						alignSelf: "center",
						paddingHorizontal: layout.pagePadding,
						paddingVertical: 28,
						gap: 20,
					}}
				>
					<Display size={layout.displaySize}>
						{copy.billing.pageTitle}
					</Display>
					{balance ? (
						<Display size={layout.isTablet ? 40 : 32}>
							{copy.billing.balance(balance.balance)}
						</Display>
					) : (
						<Body muted>{copy.billing.loading}</Body>
					)}
					<Body muted>{copy.billing.historyIntro}</Body>
					<Body muted>{copy.billing.storeNote}</Body>
					{!isPending && !session ? (
						<Button
							label={copy.home.login}
							onPress={() =>
								router.push("/login?next=%2Fcredits")
							}
						/>
					) : null}
					{!session && !isPending ? (
						<Body muted>{copy.billing.signInForCredits}</Body>
					) : null}
					{failed ? (
						<View style={{ gap: 12 }}>
							<Notice tone="danger">
								{copy.billing.historyError}
							</Notice>
							<Button
								label={copy.recipe.retry}
								variant="ghost"
								onPress={() => setAttempt((value) => value + 1)}
							/>
						</View>
					) : null}
					{session && entries && entries.length === 0 && !failed ? (
						<Body muted>{copy.billing.historyEmpty}</Body>
					) : null}
					{session && entries === null && !failed ? (
						<ActivityIndicator />
					) : null}
					{entries && entries.length > 0 ? (
						<View>
							{entries.map((entry) => (
								<View
									key={entry.id}
									style={{
										paddingVertical: 16,
										borderBottomWidth: 1,
										borderBottomColor: colors.border,
										gap: 4,
									}}
								>
									<Text
										style={{
											fontFamily: fonts.body,
											fontSize: 18,
											color: colors.foreground,
										}}
									>
										{historyLabel(entry, copy.billing)}
									</Text>
									<Text
										style={{
											fontFamily: fonts.body,
											fontSize: 15,
											color: colors.mutedForeground,
										}}
									>
										{formatDate(entry.createdAt, locale)}
									</Text>
								</View>
							))}
						</View>
					) : null}
				</View>
				<Footer />
			</ScrollView>
		</Screen>
	);
}

function formatDate(value: string, locale: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
		date,
	);
}

function historyLabel(
	entry: CreditEntry,
	billing: {
		historyWelcome: (count: number) => string;
		historyPurchase: (count: number) => string;
		historyImport: (count: number) => string;
		historyRefund: (count: number) => string;
		historyDispute: (count: number) => string;
		historyAdjustAdd: (count: number) => string;
		historyAdjustRemove: (count: number) => string;
	},
) {
	const count = Math.abs(entry.amount);
	switch (entry.type) {
		case "welcome":
			return billing.historyWelcome(count);
		case "purchase":
			return billing.historyPurchase(count);
		case "import":
			return billing.historyImport(count);
		case "refund":
			return billing.historyRefund(count);
		case "dispute":
			return billing.historyDispute(count);
		case "adjustment":
			return entry.amount >= 0
				? billing.historyAdjustAdd(count)
				: billing.historyAdjustRemove(count);
	}
}
