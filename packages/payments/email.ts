const DISPOSABLE_DOMAINS = new Set([
	"10minutemail.com",
	"discard.email",
	"dispostable.com",
	"fakeinbox.com",
	"getnada.com",
	"guerrillamail.com",
	"guerrillamail.info",
	"mailinator.com",
	"mailnesia.com",
	"maildrop.cc",
	"mintemail.com",
	"moakt.com",
	"mytemp.email",
	"sharklasers.com",
	"temp-mail.org",
	"tempmail.com",
	"tempmailo.com",
	"throwaway.email",
	"trashmail.com",
	"yopmail.com",
]);

/** Lowercase, drop +tags, and collapse Gmail dots. Returns null when the address is unusable. */
export function normalizeEmail(email: string) {
	const trimmed = email.trim().toLowerCase();
	const at = trimmed.lastIndexOf("@");
	if (at < 1 || at === trimmed.length - 1) {
		return null;
	}

	let local = trimmed.slice(0, at);
	let domain = trimmed.slice(at + 1);
	const plus = local.indexOf("+");
	if (plus >= 0) {
		local = local.slice(0, plus);
	}
	if (domain === "googlemail.com") {
		domain = "gmail.com";
	}
	if (domain === "gmail.com") {
		local = local.replaceAll(".", "");
	}
	if (!local || !domain.includes(".")) {
		return null;
	}
	return `${local}@${domain}`;
}

export function isDisposableEmail(normalizedEmail: string) {
	const domain = normalizedEmail.slice(normalizedEmail.lastIndexOf("@") + 1);
	return DISPOSABLE_DOMAINS.has(domain);
}
