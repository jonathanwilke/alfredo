import { cn } from "@ui/lib";
import React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className, type, ...props }: InputProps) => {
	return (
		<input
			type={type}
			className={cn(
				"flex h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive",
				className,
			)}
			{...props}
		/>
	);
};

export { Input };
