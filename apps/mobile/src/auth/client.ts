import { expoClient } from "@better-auth/expo/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { siteOrigin } from "./origin";

export const authClient = createAuthClient({
	baseURL: siteOrigin,
	plugins: [
		expoClient({
			scheme: "ulivo",
			storagePrefix: "ulivo",
			storage: SecureStore,
		}),
		magicLinkClient(),
	],
});
