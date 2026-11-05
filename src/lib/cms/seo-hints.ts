/**
 * Routes that can carry a search-engine override.
 *
 * This is a hint list for the admin UI only — it is not a constraint. Any route
 * can have an override, and a route with none simply generates its own metadata.
 * Keeping the list here means the SEO screen can show an administrator the
 * obvious candidates without querying the router.
 */

import { PUBLIC_ROUTES, ROUTE_TITLES } from '@/lib/config/site';

export type SeoRouteHint = {
  route: string;
  description: string;
};

export const ROUTES_WITH_SEO_HINTS: SeoRouteHint[] = PUBLIC_ROUTES.map((route) => ({
  route,
  description: ROUTE_TITLES[route] ?? route,
}));
