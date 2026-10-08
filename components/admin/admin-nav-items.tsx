import {
  BoxIcon,
  ClipboardIcon,
  GridIcon,
  LayersIcon,
  PinIcon,
  ReceiptIcon,
  TagIcon,
  TicketIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
  // Hidden from the sidebar for a plain "admin" — only "super_admin" sees it.
  superAdminOnly?: boolean;
};

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "لوحة التحكم", icon: GridIcon, superAdminOnly: true },
  { href: "/admin/products", label: "المنتجات", icon: BoxIcon },
  { href: "/admin/categories", label: "الفئات", icon: TagIcon },
  { href: "/admin/orders", label: "الطلبات", icon: ReceiptIcon },
  { href: "/admin/customers", label: "العملاء", icon: UsersIcon },
  { href: "/admin/users", label: "المستخدمون", icon: UserIcon, superAdminOnly: true },
  { href: "/admin/suppliers", label: "الموردين", icon: TruckIcon },
  { href: "/admin/purchases", label: "المشتريات", icon: ClipboardIcon },
  { href: "/admin/inventory", label: "المخزون", icon: LayersIcon },
  { href: "/admin/coupons", label: "الكوبونات", icon: TicketIcon, superAdminOnly: true },
  { href: "/admin/shipping", label: "الشحن", icon: PinIcon },
];
