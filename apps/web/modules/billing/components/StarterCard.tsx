"use client";

import { LocaleLink } from "@i18n/routing";
import Image from "next/image";
import { useState } from "react";

export function StarterCard({
	href,
	title,
	imageUrl,
	meta,
}: {
	href: string;
	title: string;
	imageUrl: string | null;
	meta: string | null;
}) {
	const [loaded, setLoaded] = useState(false);
	const initial = title.trim().charAt(0).toUpperCase() || "·";

	return (
		<LocaleLink
			href={href}
			className="group flex min-w-0 flex-col gap-3 text-foreground no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
		>
			<div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-muted">
				{imageUrl ? (
					<>
						{loaded ? null : (
							<div className="absolute inset-0 animate-pulse bg-muted" />
						)}
						<Image
							src={imageUrl}
							alt=""
							fill
							sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
							className={`object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
							onLoad={() => setLoaded(true)}
						/>
					</>
				) : (
					<PlateFallback initial={initial} />
				)}
			</div>
			<div className="flex flex-col gap-1 px-0.5">
				<h3 className="font-heading text-xl leading-tight text-balance">
					{title}
				</h3>
				{meta ? (
					<p className="text-sm text-muted-foreground">{meta}</p>
				) : null}
			</div>
		</LocaleLink>
	);
}

function PlateFallback({ initial }: { initial: string }) {
	return (
		<div className="relative flex size-full items-center justify-center bg-[linear-gradient(165deg,#F6F9E8_0%,#E4D3B8_100%)]">
			<svg viewBox="0 0 160 120" className="h-2/3 w-auto" aria-hidden>
				<ellipse cx="80" cy="78" rx="52" ry="18" fill="#E7DCC8" />
				<circle
					cx="80"
					cy="58"
					r="36"
					fill="#F3EDE3"
					stroke="#8E9C4A"
					strokeWidth="3"
				/>
				<circle
					cx="80"
					cy="58"
					r="20"
					fill="none"
					stroke="#C3D56D"
					strokeWidth="2"
				/>
			</svg>
			<span className="absolute font-heading text-4xl text-foreground">
				{initial}
			</span>
		</div>
	);
}
