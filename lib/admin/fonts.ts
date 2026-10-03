import { Cairo } from "next/font/google";

// Arabic-capable typeface for the admin dashboard only — the storefront
// keeps its own fonts (Manrope/Cormorant Garamond) untouched.
export const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});
