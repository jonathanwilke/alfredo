export function formatMoney(cents: number, currency: string, locale: string) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
	}).format(cents / 100);
}

export function formatCreditDate(value: string, locale: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
		date,
	);
}
