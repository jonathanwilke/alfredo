export function formatPlanPrice(
	cents: number,
	currency: string,
	locale: string,
) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
	}).format(cents / 100);
}

export function formatPlanDate(value: string | null, locale: string) {
	if (!value) {
		return null;
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
		date,
	);
}
