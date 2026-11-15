import {
  BarChart3,
  Bot,
  CalendarDays,
  Dumbbell,
  Timer,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// Orden de la barra inferior (móvil) y de la sidebar (escritorio)
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Perfil", icon: User },
  { href: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/cronometro", label: "Cronómetro", icon: Timer },
  { href: "/recap", label: "Recap", icon: BarChart3 },
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/coach", label: "Coach IA", icon: Bot },
  { href: "/historial", label: "Historial", icon: CalendarDays },
];

const byHref = (...hrefs: string[]) => hrefs.map((href) => NAV_ITEMS.find((item) => item.href === href)!);

// La barra inferior de móvil lleva 4 secciones y el botón "Más" (5 huecos).
export const BOTTOM_BAR_ITEMS = byHref("/", "/entrenar", "/recap", "/rankings");

// Lo que queda va en el menú "Más". El cronómetro se abre como hoja inferior, no como página.
export const MORE_ITEMS = byHref("/cronometro", "/coach", "/historial");

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

type RouteMeta = { title: string; /** Pantalla secundaria: muestra "atrás" en móvil y vuelve aquí si no hay historial. */ backTo?: string };

// Título de la cabecera fija en móvil. Sin entrada (Perfil, acceso, 404...) se muestra el logo.
const ROUTE_META: Record<string, RouteMeta> = {
  "/entrenar": { title: "Entrenar" },
  "/cronometro": { title: "Cronómetro" },
  "/recap": { title: "Recap" },
  "/rankings": { title: "Rankings" },
  "/coach": { title: "Coach IA", backTo: "/" },
  "/historial": { title: "Historial", backTo: "/" },
};

export function routeMeta(pathname: string): RouteMeta | null {
  const key = Object.keys(ROUTE_META).find((href) => pathname === href || pathname.startsWith(`${href}/`));
  return key ? ROUTE_META[key] : null;
}
