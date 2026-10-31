import * as SecureStore from "expo-secure-store";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type Locale = "de" | "en";

const STORAGE_KEY = "ulivo.locale";
export const defaultLocale: Locale = "en";

type Copy = ReturnType<typeof createCopy>;

const I18nContext = createContext<{
	locale: Locale;
	copy: Copy;
	ready: boolean;
	setLocale: (locale: Locale) => void;
} | null>(null);

function formatCount(locale: Locale, count: number) {
	return new Intl.NumberFormat(locale).format(count);
}

function countLabel(locale: Locale, count: number, one: string, other: string) {
	const word = locale === "en" && count === 1 ? one : other;
	return `${formatCount(locale, count)} ${word}`;
}

function createCopy(locale: Locale) {
	const de = locale === "de";
	return {
		home: {
			title: de ? "Was kochen wir?" : "What are we cooking?",
			subtitle: de
				? "Füg einen Rezept-Link ein. Daraus wird eine werbefreie Anleitung, ein Schritt pro Bildschirm."
				: "Paste a recipe link. It becomes an ad-free guide, one step per screen.",
			placeholder: de ? "Rezept-Link einfügen" : "Paste a recipe link",
			submit: de ? "Lass uns kochen" : "Let's cook",
			invalidUrl: de
				? "Das sieht nicht nach einem Link aus. Die Adresse braucht http oder https."
				: "That does not look like a link. The address needs http or https.",
			fetch_failed: de
				? "Die Seite ließ sich nicht lesen. Prüf den Link und versuch es noch einmal."
				: "That page could not be read. Check the link and try again.",
			not_a_recipe: de
				? "Das sieht nicht nach einem Rezept aus."
				: "That does not look like a recipe.",
			extract_failed: de
				? "Die Anleitung konnte nicht erstellt werden. Versuch es gleich noch einmal."
				: "The guide could not be created. Try again in a moment.",
			not_configured: de
				? "Die Rezept-Erkennung ist noch nicht eingerichtet."
				: "Recipe extraction is not set up yet.",
			theme: de ? "Darstellung wechseln" : "Switch appearance",
			login: de ? "Anmelden" : "Log in",
			loginLead: de
				? "Wir schicken dir einen Anmelde-Link."
				: "We'll email you a sign-in link.",
			loginLeadGoogle: de
				? "Melde dich mit Google an, oder wir schicken dir einen Anmelde-Link."
				: "Continue with Google, or we'll email you a sign-in link.",
			loginWithGoogle: de
				? "Mit Google fortfahren"
				: "Continue with Google",
			loginOr: de ? "oder" : "or",
			loginGoogleFailed: de
				? "Die Google-Anmeldung hat sich nicht geöffnet. Versuch es noch einmal."
				: "Google sign-in did not open. Try again.",
			logout: de ? "Abmelden" : "Log out",
			account: de ? "Konto" : "Account",
			savedRecipes: de ? "Gespeicherte Rezepte" : "Saved recipes",
			recipeCredits: de ? "Guthaben" : "Credits",
			savedEmpty: de
				? "Du hast noch keine Rezepte gespeichert."
				: "You have not saved any recipes yet.",
			savedFailed: de
				? "Die gespeicherten Rezepte konnten nicht geladen werden. Versuch es noch einmal."
				: "Saved recipes could not be loaded. Try again.",
			loginEmail: de ? "E-Mail" : "Email",
			loginSend: de ? "Link senden" : "Send link",
			loginSent: de
				? "Schau in dein Postfach nach dem Link."
				: "Check your email for the sign-in link.",
			loginFailed: de
				? "Der Link konnte nicht gesendet werden. Versuch es noch einmal."
				: "The sign-in link could not be sent. Try again.",
			locale: de ? "Sprache" : "Language",
			iconPending: de ? "Icon wird erstellt" : "Icon is on its way",
			iconFailed: de
				? "Icon konnte nicht erstellt werden"
				: "Icon could not be created",
			iconReady: de ? "Rezept-Icon" : "Recipe icon",
			startersLabel: de
				? "Kostenlose Startrezepte"
				: "Free starter recipes",
			startersTitle: de
				? "Oder fang mit einem Gericht an"
				: "Or start with a dish",
			startersPrevious: de ? "Vorherige Gerichte" : "Previous dishes",
			startersNext: de ? "Nächste Gerichte" : "Next dishes",
			startersEmpty: de
				? "Gerade sind keine Startrezepte da. Ein Link funktioniert trotzdem."
				: "No starter dishes are listed right now. A link still works.",
			offline: de
				? "Die Verbindung hat nicht geklappt. Versuch es noch einmal."
				: "The connection did not work. Try again.",
		},
		recipe: {
			ingredients: de ? "Zutaten" : "Ingredients",
			prep: de ? "Vorbereiten" : "Prep",
			cook: de ? "Kochen" : "Cook",
			start: de ? "Kochen starten" : "Start cooking",
			overview: de ? "Übersicht" : "Overview",
			next: de ? "Weiter" : "Next",
			previous: de ? "Zurück" : "Back",
			done: de ? "Fertig" : "Done",
			timerDone: de ? "Die Zeit ist um" : "Time is up",
			timerReturn: de ? "Zurück zum Timer" : "Back to the timer",
			save: de ? "Rezept speichern" : "Save recipe",
			saved: de ? "Gespeichert" : "Saved",
			saveEmail: de ? "E-Mail" : "Email",
			saveSend: de ? "Link senden" : "Send link",
			saveSent: de
				? "Schau in dein Postfach nach dem Link. Danach ist das Rezept gespeichert."
				: "Check your email for the sign-in link. Then this recipe is saved.",
			saveFailed: de
				? "Das Rezept konnte nicht gespeichert werden. Versuch es noch einmal."
				: "The recipe could not be saved. Try again.",
			share: de ? "Teilen" : "Share",
			stopSharing: de ? "Nicht mehr teilen" : "Stop sharing",
			linkCopied: de ? "Link kopiert" : "Link copied",
			shareFailed: de
				? "Das Rezept konnte nicht geteilt werden. Versuch es noch einmal."
				: "The recipe could not be shared. Try again.",
			missing: de
				? "Dieses Rezept ist nicht da."
				: "That recipe is not here.",
			loadFailed: de
				? "Das Rezept konnte nicht geladen werden."
				: "The recipe could not be loaded.",
			retry: de ? "Nochmal versuchen" : "Try again",
			servings: (count: number) =>
				de
					? count === 1
						? "1 Portion"
						: `${count} Portionen`
					: count === 1
						? "1 serving"
						: `${count} servings`,
			minutes: (count: number) => (de ? `${count} Min.` : `${count} min`),
			progress: (current: number, total: number) =>
				`${current} / ${total}`,
			curated: (served: string) =>
				served === "de"
					? de
						? "Dieses Gericht wird auf Deutsch gezeigt."
						: "This dish is shown in German."
					: de
						? "Dieses Gericht wird auf Englisch gezeigt."
						: "This dish is shown in English.",
			stepIngredients: de ? "In diesem Schritt" : "In this step",
			stepLabel: (step: number) =>
				de ? `Schritt ${step}` : `Step ${step}`,
			timerPause: de ? "Pause" : "Pause",
			timerResume: de ? "Fortsetzen" : "Resume",
			timerCancel: de ? "Abbrechen" : "Cancel",
			timerAdd: de ? "+1 Min." : "+1 min",
		},
		billing: {
			pageTitle: de ? "Guthaben" : "Credits",
			loading: de ? "Guthaben wird geladen." : "Loading your credits.",
			emptyTitle: de ? "Du brauchst ein Guthaben" : "You need a credit",
			emptyBody: de
				? "Ein Guthaben erzeugt ein Rezept aus einem Link. Startgerichte und gespeicherte Rezepte sind kostenlos."
				: "One credit generates one recipe from a link. Starter dishes and saved recipes are free.",
			storeNote: de
				? "Diese App verkauft kein Guthaben und verlinkt nicht zu einer Kasse. Apple und Google verlangen In-App-Käufe für digitale Güter. Guthaben, das schon auf deinem Konto liegt, kannst du hier verbrauchen. Neue Konten starten mit Freiguthaben nach der Anmeldung."
				: "This app does not sell credits and does not link to checkout. Apple and Google require in-app purchases for digital goods. Credits already on your account can be used here. New accounts start with free credits after you sign in.",
			seeCredits: de ? "Guthaben ansehen" : "See credits",
			balance: (count: number) =>
				de
					? count === 1
						? "1 Guthaben übrig"
						: count === 0
							? "Kein Guthaben übrig"
							: `${count} Guthaben übrig`
					: count === 1
						? "1 credit left"
						: count === 0
							? "No credits left"
							: `${count} credits left`,
			historyIntro: de
				? "Mit einem Guthaben lässt du ein Rezept aus einem Link erstellen. Gespeicherte Rezepte kosten nichts."
				: "One credit generates one recipe from a link. Saved recipes cost nothing.",
			usageOf: (used: number, total: number) => {
				const usedText = formatCount(locale, used);
				const totalText = formatCount(locale, total);
				if (de) {
					return `${usedText} von ${totalText} Guthaben verbraucht`;
				}
				return total === 1
					? `${usedText} of ${totalText} credit used`
					: `${usedText} of ${totalText} credits used`;
			},
			usageRemaining: (count: number) =>
				de
					? `${formatCount(locale, count)} übrig`
					: `${formatCount(locale, count)} remaining`,
			historyEmpty: de
				? "Hier ist noch nichts. Dein kostenloses Guthaben steht hier, nachdem du dich mit einer bestätigten E-Mail angemeldet hast."
				: "Nothing here yet. Your free credits show up after you sign in with a verified email.",
			historyError: de
				? "Die Liste konnte nicht geladen werden."
				: "Your credit history could not be loaded.",
			signInForCredits: de
				? "Melde dich an, um dein Guthaben zu sehen."
				: "Log in to see your credit balance.",
			historyWelcome: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} gratis`
					: `${countLabel(locale, count, "free credit", "free credits")}`,
			historyPurchase: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} gekauft`
					: `${countLabel(locale, count, "credit bought", "credits bought")}`,
			historyImport: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} verbraucht`
					: `${countLabel(locale, count, "credit used", "credits used")}`,
			historyRefund: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} erstattet`
					: `${countLabel(locale, count, "credit returned", "credits returned")}`,
			historyDispute: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} zurückgebucht`
					: `${countLabel(locale, count, "credit reversed", "credits reversed")}`,
			historyAdjustAdd: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} hinzugefügt`
					: `${countLabel(locale, count, "credit added", "credits added")}`,
			historyAdjustRemove: (count: number) =>
				de
					? `${countLabel(locale, count, "Guthaben", "Guthaben")} abgezogen`
					: `${countLabel(locale, count, "credit removed", "credits removed")}`,
		},
		connect: {
			menu: de ? "KI-Assistenten" : "AI assistants",
			title: de
				? "Mit KI-Assistenten verbinden"
				: "Connect to AI assistants",
			lead: de
				? "Füg diese Adresse in Claude, Cursor oder ChatGPT ein. Melde dich im Browser mit deinem ulivo-Konto an. Ein neues Rezept kostet ein Guthaben. Lesen ist gratis."
				: "Paste this address into Claude, Cursor, or ChatGPT. Sign in with your ulivo account in the browser. A new recipe uses one credit. Reading is free.",
			claude: de
				? "Claude: Connector hinzufügen und die Adresse einfügen."
				: "Claude: add a custom connector and paste the address.",
			cursor: de
				? "Cursor: Einstellungen, MCP, Server hinzufügen."
				: "Cursor: Settings, MCP, add a server.",
			chatgpt: de
				? "ChatGPT: Connector hinzufügen und die Adresse einfügen."
				: "ChatGPT: add a connector and paste the address.",
		},
		footer: {
			language: de ? "Sprache" : "Language",
			builtBy: de ? "Gebaut von" : "Built by",
		},
	};
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(defaultLocale);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void SecureStore.getItemAsync(STORAGE_KEY)
			.then((stored) => {
				if (cancelled) {
					return;
				}
				if (stored === "de" || stored === "en") {
					setLocaleState(stored);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setReady(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const setLocale = (next: Locale) => {
		setLocaleState(next);
		void SecureStore.setItemAsync(STORAGE_KEY, next);
	};

	const value = useMemo(
		() => ({
			locale,
			copy: createCopy(locale),
			ready,
			setLocale,
		}),
		[locale, ready],
	);

	return (
		<I18nContext.Provider value={value}>{children}</I18nContext.Provider>
	);
}

export function useI18n() {
	const value = useContext(I18nContext);
	if (!value) {
		throw new Error("I18nProvider missing");
	}
	return value;
}
