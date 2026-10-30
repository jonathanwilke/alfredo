import { getRecipe } from "./procedures/get";
import { importRecipe } from "./procedures/import";
import {
	listSavedRecipes,
	recipeSaved,
	saveRecipe,
	unsaveRecipe,
} from "./procedures/save";
import {
	disableShare,
	enableShare,
	readSharedRecipe,
} from "./procedures/share";
import { starters } from "./procedures/starters";

export const recipesRouter = {
	get: getRecipe,
	starters,
	import: importRecipe,
	saved: recipeSaved,
	listSaved: listSavedRecipes,
	save: saveRecipe,
	unsave: unsaveRecipe,
	share: enableShare,
	unshare: disableShare,
	shared: readSharedRecipe,
};
