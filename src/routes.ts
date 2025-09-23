export type AuthLandingMode = 'login' | 'register';

type RouteKind = 'app' | 'landing';

type RouteInfo = {
  href: string;
  pathname: string;
  variants: Set<string>;
  baseOrigin: string;
};

const ROUTE_FALLBACK: Record<RouteKind, string> = {
  app: 'index.html',
  landing: 'landing.html',
};

const ROUTE_ENV_KEYS: Record<RouteKind, readonly string[]> = {
  app: ['VITE_APP_URL', 'VITE_APP_PATH', 'VITE_APP_ENTRY'],
  landing: ['VITE_LANDING_URL', 'VITE_LANDING_PATH'],
};

const getBaseOrigin = () =>
  typeof window !== 'undefined' && window.location ? window.location.origin : 'https://example.invalid';

const envValue = (key: string): string | undefined => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : undefined;
};

const pickFirstEnvValue = (keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = envValue(key);
    if (value) return value;
  }
  return undefined;
};

const ensureUrl = (input: string | undefined, fallback: string): URL => {
  const base = getBaseOrigin();
  const candidate = input && input.trim() ? input.trim() : fallback;
  try {
    return new URL(candidate, base);
  } catch (error) {
    console.warn('Invalid route configuration for', candidate, error);
    return new URL(fallback, base);
  }
};

const normalizePath = (pathname: string): string => {
  if (!pathname) return '/';
  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const withoutTrailing = prefixed.replace(/\/+$/u, '');
  return withoutTrailing || '/';
};

const buildPathVariants = (pathname: string): Set<string> => {
  const variants = new Set<string>();
  const normalized = normalizePath(pathname);

  variants.add(normalized);

  if (normalized !== '/') {
    if (normalized.endsWith('.html')) {
      variants.add(normalizePath(normalized.slice(0, -5)));
    } else {
      variants.add(normalizePath(`${normalized}.html`));
      variants.add(normalizePath(`${normalized}/index`));
      variants.add(normalizePath(`${normalized}/index.html`));
    }
  }

  if (normalized === '/' || normalized === '/index' || normalized === '/index.html') {
    variants.add('/');
    variants.add('/index');
    variants.add('/index.html');
  }

  return variants;
};

let cachedAppRoute: RouteInfo | null = null;
let cachedLandingRoute: RouteInfo | null = null;

const computeRouteInfo = (kind: RouteKind): RouteInfo => {
  const baseOrigin = getBaseOrigin();
  const cached = kind === 'app' ? cachedAppRoute : cachedLandingRoute;
  if (cached && cached.baseOrigin === baseOrigin) return cached;

  const envConfigured = pickFirstEnvValue(ROUTE_ENV_KEYS[kind]);
  const url = ensureUrl(envConfigured, ROUTE_FALLBACK[kind]);
  const info: RouteInfo = {
    href: url.toString(),
    pathname: url.pathname,
    variants: buildPathVariants(url.pathname),
    baseOrigin,
  };

  if (kind === 'app') cachedAppRoute = info; else cachedLandingRoute = info;
  return info;
};

export const buildAppUrl = (): string => computeRouteInfo('app').href;

export const buildLandingUrl = (mode: AuthLandingMode = 'login'): string => {
  const base = computeRouteInfo('landing').href;
  const url = new URL(base);
  if (mode) url.searchParams.set('auth', mode);
  return url.toString();
};

export const isAppPath = (pathname: string): boolean => {
  const normalized = normalizePath(pathname);
  return computeRouteInfo('app').variants.has(normalized);
};

export const isLandingPath = (pathname: string): boolean => {
  const normalized = normalizePath(pathname);
  return computeRouteInfo('landing').variants.has(normalized);
};
