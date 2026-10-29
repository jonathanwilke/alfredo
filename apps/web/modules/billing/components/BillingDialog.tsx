"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

export function BillingDialog({
	open,
	title,
	description,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	description: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		const node = ref.current;
		if (!node) {
			return;
		}
		if (open) {
			if (!node.open) {
				node.showModal();
			}
			return;
		}
		if (node.open) {
			node.close();
		}
	}, [open]);

	return (
		<dialog
			ref={ref}
			aria-labelledby={titleId}
			aria-describedby={descriptionId}
			className="m-auto w-[min(32rem,calc(100%-2.5rem))] max-h-[min(40rem,calc(100dvh-2.5rem))] overflow-y-auto rounded-2xl border bg-card p-6 text-card-foreground backdrop:bg-foreground/40 sm:p-8"
			onClose={onClose}
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) {
					event.currentTarget.close();
				}
			}}
		>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<h2
						id={titleId}
						className="text-balance text-3xl leading-tight font-semibold tracking-tight"
					>
						{title}
					</h2>
					<p
						id={descriptionId}
						className="text-lg leading-relaxed text-muted-foreground"
					>
						{description}
					</p>
				</div>
				{children}
			</div>
		</dialog>
	);
}
