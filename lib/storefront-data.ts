export type Category = {
  id: string;
  name: string;
  image: string;
  slug: string;
  parentId: string | null;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  category: string;
  description: string;
  sku: string;
  stock: number;
};

// A product's `category` field always stores the name of a leaf category
// (e.g. "Dress"), never a parent like "Clothes" — see the clothes_subcategories
// migration. So selecting a parent category with no subcategory chosen means
// "match any of its children's names", not the parent's own name. Returns
// null for "no filter" (show everything).
export function resolveCategoryProductNames(categories: Category[], categorySlug: string, subcategorySlug: string): string[] | null {
  if (!categorySlug) return null;
  const category = categories.find((item) => item.slug === categorySlug);
  if (!category) return null;

  if (subcategorySlug) {
    const subcategory = categories.find((item) => item.slug === subcategorySlug && item.parentId === category.id);
    return [(subcategory ?? category).name];
  }

  const children = categories.filter((item) => item.parentId === category.id);
  return children.length > 0 ? children.map((item) => item.name) : [category.name];
}

export function productMatchesNames(product: Product, names: string[] | null): boolean {
  if (!names) return true;
  return names.some((name) => name.toLowerCase() === product.category.toLowerCase());
}

export const navItems = [
  "Home",
  "Categories",
  "Offers",
  "Contact Us",
];

export const promoCards = [
  { title: "New Arrivals", subtitle: "Fresh styles just for you", accent: "#f3e3dc" },
  { title: "Special Offer", subtitle: "Up to 30% OFF", accent: "#f4dfe0" },
  { title: "Gift for Her", subtitle: "The perfect gift for every moment", accent: "#f5e9e1" },
];

export const benefits = [
  { title: "Free Shipping", description: "On orders over $50" },
  { title: "Easy Returns", description: "14 days return policy" },
  { title: "Secure Payment", description: "100% secure payment" },
  { title: "Customer Support", description: "24/7 support" },
];

export const footerColumns = {
  shop: ["Jewelry", "Accessories", "Bags", "New Arrivals", "Best Sellers", "Sale"],
  customer: ["Shipping & Delivery", "Returns & Exchanges", "FAQ", "Size Guide", "Contact Us"],
  info: ["About", "Our Stores", "Privacy Policy", "Terms & Conditions"],
};

