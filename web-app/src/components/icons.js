import {
  Archive,
  BookOpen,
  Building2,
  Drum,
  Gamepad2,
  Hammer,
  Home,
  Landmark,
  Languages,
  Leaf,
  Library,
  Network,
  Shirt,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react'

// Icône Lucide associée à chaque catégorie culturelle (code A à O).
export const CATEGORY_ICONS = {
  A: Users,
  B: Landmark,
  C: Languages,
  D: UtensilsCrossed,
  E: Drum,
  F: BookOpen,
  G: Sparkles,
  H: Network,
  I: Shirt,
  J: Hammer,
  K: Home,
  L: Leaf,
  M: Gamepad2,
  N: Building2,
  O: Archive,
}

export const categoryIcon = (code) => CATEGORY_ICONS[code] ?? Library
