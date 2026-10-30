import { useWindowDimensions } from "react-native";

export function useLayout() {
	const { width, height } = useWindowDimensions();
	const shortest = Math.min(width, height);
	const isTablet = shortest >= 600;
	const isLandscape = width > height;
	const split = isTablet && width >= 900;
	const pagePadding = isTablet ? 32 : 20;
	const contentWidth = isTablet ? 1040 : 720;
	const ingredientColumns = width >= 1100 ? 3 : width >= 680 ? 2 : 1;
	const displaySize = isTablet ? 60 : 40;
	return {
		width,
		height,
		isTablet,
		isLandscape,
		split,
		pagePadding,
		contentWidth,
		ingredientColumns,
		displaySize,
	};
}
