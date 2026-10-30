import { cn } from "@ui/lib";
import React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = ({
	className,
	type,
	ref,
	...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) => {
	return (
		<input
			type={type}
			ref={ref}
			className={cn(
				"flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
};

export { Input };
