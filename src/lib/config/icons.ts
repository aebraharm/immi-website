import {
  Banknote,
  Briefcase,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Globe2,
  GraduationCap,
  Handshake,
  HeartPulse,
  Home,
  Languages,
  type LucideIcon,
  MapPin,
  Plane,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';

/**
 * Icon allowlist for CMS-driven content.
 *
 * A service row stores an icon *key* (`icon_name`), never markup. This map is
 * the only thing that can turn that key into a component, so an administrator
 * can choose a recognisable icon but cannot inject anything executable. An
 * unknown key falls back to a neutral icon rather than rendering nothing.
 */

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  Briefcase,
  Globe2,
  Plane,
  FileCheck2,
  FileText,
  ClipboardCheck,
  GraduationCap,
  Languages,
  Users,
  Handshake,
  ShieldCheck,
  Scale,
  Building2,
  MapPin,
  Banknote,
  Home,
  HeartPulse,
  Stethoscope,
  Wrench,
  Truck,
  Sparkles,
};

export const SERVICE_ICON_KEYS = Object.keys(SERVICE_ICONS).sort();

export function getServiceIcon(key: string | null | undefined): LucideIcon {
  if (!key) return Briefcase;
  return SERVICE_ICONS[key] ?? Briefcase;
}
