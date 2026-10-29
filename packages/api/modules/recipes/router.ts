import { getRecipe } from "./procedures/get";
import { importRecipe } from "./procedures/import";
import {
	listSavedRecipes,
	recipeSaved,
	saveRecipe,
	unsaveRecipe,
} from "./procedures/save";

export const recipesRouter = {
	get: getRecipe,
	import: importRecipe,
	saved: recipeSaved,
	listSaved: listSavedRecipes,
	save: saveRecipe,
	unsave: unsaveRecipe,
};
