import type { RouterClient } from "@orpc/server";
import { iconsRouter } from "../modules/icons/router";
import { recipesRouter } from "../modules/recipes/router";
import { systemRouter } from "../modules/system/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure.router({
	system: systemRouter,
	icons: iconsRouter,
	recipes: recipesRouter,
});

export type ApiRouterClient = RouterClient<typeof router>;
