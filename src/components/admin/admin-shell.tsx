'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  ChevronDown,
  ClipboardList,
  FileText,
  Globe2,
  Home,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquareQuote,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Authenticated administration shell.
 *
 * Navigation is deliberately limited to what exists today. Showing a link to a
 * page that does not exist would be worse than showing fewer links, so the menu
 * only lists real destinations.
 *
 * Role-restricted items (Assessments, agency settings, search settings) are
 * hidden from roles that cannot use them *and* refused by the server. Hiding is
 * cosmetic; the server check is the boundary.
 */

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Roles that see this item. Owner sees everything. */
  roles?: readonly ('owner' | 'admin' | 'editor')[];
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

/**
 * Administration navigation.
 *
 * Grouped by what the administrator is trying to do, not by database table. Every
 * destination here exists — an item is only listed once its page is real, so the
 * menu never sends anyone to a 404.
 *
 * Settings and search-engine items are hidden from editors as well as blocked on
 * the server: showing a link that always refuses is worse than not showing it.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      // Applicant data is restricted to owners and administrators by the server
      // guard; the role here only keeps an editor from being offered a link that
      // would refuse them.
      {
        label: 'Assessments',
        href: '/admin/assessments',
        icon: ClipboardList,
        roles: ['owner', 'admin'],
      },
      { label: 'Activity log', href: '/admin/activity', icon: Activity },
    ],
  },
  {
    heading: 'Website content',
    items: [
      { label: 'Agency settings', href: '/admin/content/settings', icon: Settings, roles: ['owner'] },
      { label: 'Homepage', href: '/admin/content/homepage', icon: Home },
      { label: 'Services', href: '/admin/content/services', icon: FileText },
      { label: 'Countries', href: '/admin/content/countries', icon: MapPin },
      { label: 'Destinations', href: '/admin/content/destinations', icon: Globe2 },
      { label: 'Testimonials', href: '/admin/content/testimonials', icon: MessageSquareQuote },
      { label: 'Team', href: '/admin/content/team', icon: Users },
      { label: 'FAQs', href: '/admin/content/faqs', icon: ShieldCheck },
      { label: 'Pages', href: '/admin/content/pages', icon: FileText },
    ],
  },
  {
    heading: 'Assets and search',
    items: [
      { label: 'Media library', href: '/admin/content/media', icon: ImageIcon },
      { label: 'Search settings', href: '/admin/content/seo', icon: Search, roles: ['owner'] },
    ],
  },
  {
    heading: 'Your account',
    items: [
      { label: 'Account', href: '/admin/settings', icon: Settings },
    ],
  },
];

export function AdminShell({
  admin,
  children,
}: {
  admin: { fullName: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const mobileDrawerCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        accountTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // Treat the mobile navigation as a modal drawer: keep keyboard focus inside it,
  // lock scrolling behind it, and return focus to the control that opened it.
  useEffect(() => {
    if (!mobileOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const trigger = mobileMenuButtonRef.current;
    document.body.style.overflow = 'hidden';
    const drawer = mobileDrawerRef.current;
    mobileDrawerCloseRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      const focusIsInside = drawer.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !focusIsInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusIsInside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalBodyOverflow;
      trigger?.focus();
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // Even if the request fails, fall through to the login page: the cookie is
      // cleared server-side when the request succeeds, and the session still
      // expires on its own.
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  const initials = admin.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(admin.role as 'owner')),
  })).filter((group) => group.items.length > 0);

  const navList = (
    <nav aria-label="Administration navigation" className="space-y-4">
      {visibleGroups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {group.heading}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              // The dashboard is only "active" on exactly /admin; every other
              // item stays highlighted for its own sub-pages.
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-ink text-white'
                      : 'text-slate-600 hover:bg-white hover:text-ink',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-[var(--surface-muted)]">
      {/* Top bar */}
      <header
        inert={mobileOpen}
        className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-white/90 backdrop-blur-xl"
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open administration menu"
              aria-controls={mobileOpen ? 'admin-mobile-navigation' : undefined}
              aria-expanded={mobileOpen}
              className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border-subtle)] text-ink hover:bg-slate-50 lg:hidden"
            >
              <Menu aria-hidden="true" className="size-4" />
            </button>

            <Link href="/admin" className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="grid size-7 place-items-center rounded bg-ink text-[0.625rem] font-bold text-white"
              >
                AD
              </span>
              <span className="text-sm font-semibold tracking-tight text-ink">
                Administration
              </span>
            </Link>
          </div>

          <div className="relative flex items-center gap-2" ref={menuRef}>
            <button
              ref={accountTriggerRef}
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-controls={menuOpen ? 'admin-account-menu' : undefined}
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-slate-50"
            >
              <span className="grid size-7 place-items-center rounded-full bg-accent-600 text-[0.625rem] font-semibold text-white">
                {initials || 'A'}
              </span>
              <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:block">
                {admin.fullName}
              </span>
              <span className="sr-only">account options</span>
              <ChevronDown aria-hidden="true" className="size-3.5 text-slate-600" />
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  id="admin-account-menu"
                  role="group"
                  aria-label="Account options"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e3"
                >
                  <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                    <p className="truncate text-sm font-medium text-ink">
                      {admin.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{admin.email}</p>
                    <p className="mt-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-slate-600">
                      {admin.role}
                    </p>
                  </div>

                  <Link
                    href="/admin/settings"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Settings aria-hidden="true" className="size-4" />
                    Account settings
                  </Link>

                  <Link
                    href="/admin/change-password"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <KeyRound aria-hidden="true" className="size-4" />
                    Change password
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex w-full items-center gap-2 border-t border-[var(--border-subtle)] px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    {isSigningOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[90rem]">
        {/* Desktop sidebar */}
        <aside
          inert={mobileOpen}
          className="hidden w-60 shrink-0 border-r border-[var(--border-subtle)] bg-white lg:block"
        >
          <div className="sticky top-14 p-3">{navList}</div>
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              id="admin-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-mobile-menu-title"
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                aria-label="Close administration menu"
                onClick={() => setMobileOpen(false)}
                className="absolute inset-0 bg-ink/35 backdrop-blur-sm"
              />
              <motion.div
                ref={mobileDrawerRef}
                initial={prefersReducedMotion ? { x: 0 } : { x: '-100%' }}
                animate={{ x: 0 }}
                exit={prefersReducedMotion ? { x: 0 } : { x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-white p-3 shadow-e3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <span id="admin-mobile-menu-title" className="text-sm font-semibold text-ink">
                    Administration menu
                  </span>
                  <button
                    ref={mobileDrawerCloseRef}
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close administration menu"
                    className="inline-flex size-8 items-center justify-center rounded-md hover:bg-slate-100"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {navList}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <main
          id="main-content"
          inert={mobileOpen}
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
