import { getRecipe } from "./procedures/get";
import { importRecipe } from "./procedures/import";
import {
	listSavedRecipes,
	recipeSaved,
	saveRecipe,
	unsaveRecipe,
} from "./procedures/save";
import { starters } from "./procedures/starters";

export const recipesRouter = {
	get: getRecipe,
	starters,
	import: importRecipe,
	saved: recipeSaved,
	listSaved: listSavedRecipes,
	save: saveRecipe,
	unsave: unsaveRecipe,
};
