"use client";

import {
	ChevronLeftIcon,
	ChevronRightIcon,
	SpoonIcon,
} from "@hugeicons/core-free-icons";
import { LocaleLink } from "@i18n/routing";
import { Icon } from "@shared/components/Icon";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

export type StarterTile = {
	id: string;
	href: string;
	title: string;
	imageUrl: string | null;
	meta: string | null;
};

export function StarterCarousel({ tiles }: { tiles: StarterTile[] }) {
	const t = useTranslations("home");
	const scroller = useRef<HTMLDivElement>(null);
	const [canPrev, setCanPrev] = useState(false);
	const [canNext, setCanNext] = useState(false);

	const updateEnds = useCallback(() => {
		const el = scroller.current;
		if (!el) {
			return;
		}
		const max = el.scrollWidth - el.clientWidth;
		setCanPrev(el.scrollLeft > 4);
		setCanNext(el.scrollLeft < max - 4);
	}, []);

	useEffect(() => {
		updateEnds();
		const el = scroller.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver(updateEnds);
		observer.observe(el);
		return () => observer.disconnect();
	}, [updateEnds, tiles.length]);

	function scrollByCard(direction: number) {
		const el = scroller.current;
		const card = el?.querySelector<HTMLElement>("[data-starter-card]");
		if (!el || !card) {
			return;
		}
		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const gap = 16;
		el.scrollBy({
			left: direction * (card.offsetWidth + gap),
			behavior: reduce ? "auto" : "smooth",
		});
	}

	return (
		<div className="relative">
			<div
				ref={scroller}
				onScroll={updateEnds}
				className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth motion-reduce:scroll-auto"
			>
				{tiles.map((tile) => (
					<div
						key={tile.id}
						data-starter-card
						className="w-[62%] shrink-0 snap-start md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
					>
						<StarterCard tile={tile} />
					</div>
				))}
			</div>
			<CarouselButton
				label={t("startersPrevious")}
				disabled={!canPrev}
				onClick={() => scrollByCard(-1)}
				className="left-3 sm:left-4"
			>
				<Icon icon={ChevronLeftIcon} aria-hidden />
			</CarouselButton>
			<CarouselButton
				label={t("startersNext")}
				disabled={!canNext}
				onClick={() => scrollByCard(1)}
				className="right-3 sm:right-4"
			>
				<Icon icon={ChevronRightIcon} aria-hidden />
			</CarouselButton>
		</div>
	);
}

function CarouselButton({
	label,
	disabled,
	onClick,
	className,
	children,
}: {
	label: string;
	disabled: boolean;
	onClick: () => void;
	className: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className={`absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground disabled:pointer-events-none disabled:opacity-40 lg:flex ${className}`}
		>
			{children}
		</button>
	);
}

function StarterCard({ tile }: { tile: StarterTile }) {
	const t = useTranslations("recipe");
	const [loaded, setLoaded] = useState(false);
	const initial = tile.title.trim().charAt(0).toUpperCase() || "·";

	return (
		<div className="relative">
			<LocaleLink
				href={tile.href}
				className="group relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-muted text-white no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
			>
				{tile.imageUrl ? (
					<>
						{loaded ? null : (
							<div className="absolute inset-0 animate-pulse bg-muted" />
						)}
						<Image
							src={tile.imageUrl}
							alt=""
							fill
							sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 62vw"
							className={`object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${loaded ? "opacity-100" : "opacity-0"}`}
							onLoad={() => setLoaded(true)}
						/>
					</>
				) : (
					<PlateFallback initial={initial} />
				)}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1A1D14]/90 via-[#1A1D14]/40 to-transparent pt-16 pr-16 pb-4 pl-4">
					<h3 className="font-heading text-lg leading-tight text-balance text-white sm:text-xl">
						{tile.title}
					</h3>
					{tile.meta ? (
						<p className="mt-1 text-sm text-white/80">
							{tile.meta}
						</p>
					) : null}
				</div>
			</LocaleLink>
			<LocaleLink
				href={`${tile.href}?cook=1`}
				aria-label={t("start")}
				onClick={(event) => event.stopPropagation()}
				className="absolute right-3 bottom-3 z-10 grid size-10 place-items-center rounded-full bg-accent text-accent-foreground no-underline shadow-[0_8px_16px_-8px_rgba(26,29,20,0.8)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
			>
				<Icon icon={SpoonIcon} aria-hidden />
			</LocaleLink>
		</div>
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
