import {
  BarChart3,
  Bot,
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
];

// En la barra inferior de móvil caben 5; el Coach IA queda en la sidebar
// y se enlazará desde el perfil (alertas de fatiga).
export const BOTTOM_BAR_ITEMS = NAV_ITEMS.slice(0, 5);
