import Link from "next/link";
import Image from "next/image";
import type { Category } from "@/lib/storefront-data";

export function CategoryCard({ category, href }: { category: Category; href?: string }) {
  return (
    <Link href={href ?? `/products?category=${encodeURIComponent(category.slug)}`} className="group block overflow-hidden rounded-[20px] bg-[#f3eee7] shadow-[0_10px_24px_rgba(60,38,28,0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(60,38,28,0.1)]">
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={category.image}
          alt={category.name}
          fill
          sizes="(min-width: 1280px) 14vw, (min-width: 640px) 30vw, 45vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#1b1512]/55 via-transparent to-transparent" />
        <span className="absolute inset-x-0 bottom-0 block px-3 pb-4 text-center text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white">{category.name}</span>
      </div>
    </Link>
  );
}
