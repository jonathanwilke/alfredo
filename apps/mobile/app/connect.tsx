import { ScrollView, Text } from "react-native";
import { siteOrigin } from "@/auth/origin";
import { Footer, Header } from "@/components/Chrome";
import { Body, Display, Screen } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useLayout } from "@/lib/layout";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";

export default function ConnectScreen() {
	const { copy } = useI18n();
	const { colors } = useTheme();
	const { pagePadding } = useLayout();
	const url = `${siteOrigin}/api/mcp`;

	return (
		<Screen>
			<Header />
			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: pagePadding,
					paddingBottom: 32,
					gap: 20,
				}}
			>
				<Display size={40}>{copy.connect.title}</Display>
				<Body muted>{copy.connect.lead}</Body>
				<Text
					selectable
					style={{
						fontFamily: fonts.body,
						fontSize: 16,
						color: colors.foreground,
					}}
				>
					{url}
				</Text>
				<Body>{copy.connect.claude}</Body>
				<Body>{copy.connect.cursor}</Body>
				<Body>{copy.connect.chatgpt}</Body>
			</ScrollView>
			<Footer />
		</Screen>
	);
}
