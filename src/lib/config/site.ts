/**
 * Navigation and copy that is application structure, not editable content.
 *
 * The distinction matters for your rule 19: labels here define *which pages
 * exist and what they are called in the menu*. They are not marketing copy —
 * every heading, paragraph, description and contact detail on those pages comes
 * from the database.
 *
 * The main call-to-action label is fixed by the specification and must read
 * exactly as below.
 */

/** The mandated call-to-action wording. Do not change. */
export const PRIMARY_CTA_LABEL = 'Book a Consultation Now';

/** Where the primary call-to-action leads. */
export const PRIMARY_CTA_HREF = '/assessment';

export type NavItem = {
  label: string;
  href: string;
};

/**
 * Primary desktop navigation.
 *
 * The Admin Login link is appended separately by the header so it can be hidden
 * on mobile without appearing in the mobile menu at all.
 */
export const MAIN_NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About Us', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'Testimonials', href: '/testimonials' },
  { label: 'Our Team', href: '/team' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

/** Legal / secondary links shown in the footer. */
export const FOOTER_LEGAL: NavItem[] = [
  { label: 'Terms and Conditions', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
];

export const ADMIN_LOGIN_LABEL = 'Admin Login';
export const ADMIN_LOGIN_HREF = '/admin/login';

/** Routes that exist in the public site, used by the sitemap. */
export const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/services',
  '/destinations',
  '/testimonials',
  '/team',
  '/faq',
  '/contact',
  '/assessment',
  '/terms',
  '/privacy',
] as const;

/** Route -> human page name, used for consistent headings and metadata. */
export const ROUTE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/about': 'About Us',
  '/services': 'Services',
  '/destinations': 'Destinations',
  '/testimonials': 'Testimonials',
  '/team': 'Our Team',
  '/faq': 'Frequently Asked Questions',
  '/contact': 'Contact Us',
  '/assessment': 'Book a Consultation',
  '/terms': 'Terms and Conditions',
  '/privacy': 'Privacy Policy',
};
