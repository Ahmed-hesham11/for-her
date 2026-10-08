import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";

// Plain data, not a component — lives outside site-footer.tsx (a "use
// client" file) so Server Components can import it too. Every export of a
// "use client" module becomes a client reference in the server bundle, so a
// server component importing SOCIAL_LINKS from there would get a reference
// proxy instead of the real array (the contact-us route's "SOCIAL_LINKS.find
// is not a function" crash).
export const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/forher_272?stkn=MWQwcW10ZWc5cWlhMA%3D%3D&utm_source=qr", Icon: InstagramIcon },
  { label: "Facebook", href: "https://www.facebook.com/share/19Sze6D5LZ/?mibextid=wwXIfr", Icon: FacebookIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@forher_272?_r=1&_t=ZS-99ozpDmcKkm", Icon: TikTokIcon },
  { label: "WhatsApp", href: "https://wa.me/201035109074", Icon: WhatsAppIcon },
];
