import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { authClient } from "@/auth/client";
import { Footer, Header } from "@/components/Chrome";
import { Body, Button, Display, Field, Notice, Screen } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { oneParam, safeNext } from "@/lib/params";

export default function LoginScreen() {
	const { copy } = useI18n();
	const layout = useLayout();
	const router = useRouter();
	const params = useLocalSearchParams<{ next?: string }>();
	const destination = safeNext(oneParam(params.next));
	const { data: session } = authClient.useSession();
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [googlePending, setGooglePending] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (session) {
			router.replace(destination);
		}
	}, [session, destination, router]);

	async function sendLink() {
		const address = email.trim();
		if (!address) {
			return;
		}
		setPending(true);
		setNotice(null);
		setFailed(false);
		const { error } = await authClient.signIn.magicLink({
			email: address,
			callbackURL: destination,
		});
		setPending(false);
		setFailed(Boolean(error));
		setNotice(error ? copy.home.loginFailed : copy.home.loginSent);
	}

	async function continueWithGoogle() {
		setGooglePending(true);
		setNotice(null);
		setFailed(false);
		try {
			const { error } = await authClient.signIn.social({
				provider: "google",
				callbackURL: destination,
			});
			if (error) {
				setFailed(true);
				setNotice(copy.home.loginGoogleFailed);
				setGooglePending(false);
				return;
			}
			router.replace(destination);
		} catch {
			setFailed(true);
			setNotice(copy.home.loginGoogleFailed);
			setGooglePending(false);
		}
	}

	return (
		<Screen>
			<Header />
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{
					flexGrow: 1,
					justifyContent: "center",
				}}
			>
				<View
					style={{
						width: "100%",
						maxWidth: 480,
						alignSelf: "center",
						paddingHorizontal: layout.pagePadding,
						paddingVertical: 32,
						gap: 28,
					}}
				>
					<View style={{ gap: 16 }}>
						<Display size={layout.displaySize} center>
							{copy.home.login}
						</Display>
						<Body center muted>
							{copy.home.loginLeadGoogle}
						</Body>
					</View>
					<View style={{ gap: 12 }}>
						<Button
							label={copy.home.loginWithGoogle}
							variant="outline"
							loading={googlePending}
							icon={<GoogleMark />}
							onPress={() => void continueWithGoogle()}
						/>
						<Body center muted size={14}>
							{copy.home.loginOr}
						</Body>
						<Field
							label={copy.home.loginEmail}
							value={email}
							onChangeText={setEmail}
							keyboardType="email-address"
							autoComplete="email"
							placeholder={copy.home.loginEmail}
							onSubmitEditing={() => void sendLink()}
						/>
						<Button
							label={copy.home.loginSend}
							loading={pending}
							onPress={() => void sendLink()}
						/>
						{notice ? (
							<Notice tone={failed ? "danger" : "muted"}>
								{notice}
							</Notice>
						) : null}
					</View>
				</View>
				<Footer />
			</ScrollView>
		</Screen>
	);
}

function GoogleMark() {
	return (
		<Svg width={20} height={20} viewBox="0 0 18 18">
			<Path
				fill="#4285F4"
				d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
			/>
			<Path
				fill="#34A853"
				d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
			/>
			<Path
				fill="#FBBC05"
				d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
			/>
			<Path
				fill="#EA4335"
				d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
			/>
		</Svg>
	);
}
