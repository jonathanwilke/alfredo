import { useLocalSearchParams } from "expo-router";
import { RecipeScreen } from "@/components/RecipeScreen";
import { oneParam } from "@/lib/params";

export default function RecipeRoute() {
	const params = useLocalSearchParams<{ id?: string }>();
	const id = oneParam(params.id);
	if (!id) {
		return null;
	}
	return <RecipeScreen recipeId={id} />;
}
