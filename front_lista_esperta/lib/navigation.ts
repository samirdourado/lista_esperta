export type NavIcon = "list" | "receipt" | "info";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Other paths that should mark this item as current. */
  matches?: string[];
};

export const SHOPPER_NAV: NavItem[] = [
  { href: "/", label: "Minha lista", icon: "list", matches: ["/verdict"] },
  { href: "/receipts/import", label: "Enviar nota", icon: "receipt" },
  { href: "/how-it-works", label: "Como calculamos", icon: "info" },
];

export function isCurrent(item: NavItem, pathname: string): boolean {
  const paths = [item.href, ...(item.matches ?? [])];
  return paths.some((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)));
}
