import type { config } from "@repo/config";
import type messages from "./translations/de.json";

export type Messages = typeof messages;

export type Locale = keyof (typeof config)["i18n"]["locales"];
