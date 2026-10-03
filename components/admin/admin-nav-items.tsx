import {
  BoxIcon,
  ClipboardIcon,
  GridIcon,
  PinIcon,
  ReceiptIcon,
  TagIcon,
  TicketIcon,
  TruckIcon,
  UsersIcon,
} from "@/components/icons";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
};

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "لوحة التحكم", icon: GridIcon },
  { href: "/admin/products", label: "المنتجات", icon: BoxIcon },
  { href: "/admin/categories", label: "الفئات", icon: TagIcon },
  { href: "/admin/orders", label: "الطلبات", icon: ReceiptIcon },
  { href: "/admin/customers", label: "العملاء", icon: UsersIcon },
  { href: "/admin/suppliers", label: "الموردين", icon: TruckIcon },
  { href: "/admin/purchases", label: "المشتريات", icon: ClipboardIcon },
  { href: "/admin/coupons", label: "الكوبونات", icon: TicketIcon },
  { href: "/admin/shipping", label: "الشحن", icon: PinIcon },
];
