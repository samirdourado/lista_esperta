export type NavIcon = "list" | "store" | "receipt" | "info";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Other paths that should mark this item as current. */
  matches?: string[];
  /** Shown in the phone tab bar (three slots); the others live in the header and footer. */
  tab?: boolean;
};

export const SHOPPER_NAV: NavItem[] = [
  { href: "/", label: "Minha lista", icon: "list", matches: ["/verdict"], tab: true },
  { href: "/stores", label: "Lojas", icon: "store", tab: true },
  { href: "/receipts/import", label: "Enviar nota", icon: "receipt", tab: true },
  { href: "/how-it-works", label: "Como calculamos", icon: "info" },
];

export function isCurrent(item: NavItem, pathname: string): boolean {
  const paths = [item.href, ...(item.matches ?? [])];
  return paths.some((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)));
}

export const TAB_NAV = SHOPPER_NAV.filter((item) => item.tab);
