"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/components/locale-provider";
import { useWishlistActions, useWishlistState } from "@/components/wishlist-provider";
import type { Product } from "@/lib/storefront-data";

export function WishlistButton({
  product,
  className,
  activeClassName = "",
  iconClassName = "h-4 w-4",
}: {
  product: Product;
  className: string;
  activeClassName?: string;
  iconClassName?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();
  const { productIds } = useWishlistState();
  const { addToWishlist, removeFromWishlist } = useWishlistActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isActive = productIds.has(product.id);

  const handleClick = async () => {
    if (isSubmitting) return;
    if (!user) {
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isActive) {
        await removeFromWishlist(product.id);
      } else {
        await addToWishlist(product);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSubmitting}
      aria-pressed={isActive}
      aria-label={isActive ? t.wishlistButton.removeAria(product.name) : t.wishlistButton.saveAria(product.name)}
      className={`${className} ${isActive ? activeClassName : ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <HeartIcon className={iconClassName} filled={isActive} />
    </button>
  );
}
