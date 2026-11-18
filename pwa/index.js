// What every Cloudflare-hosted PWA in ~/Developer shares about its one origin:
// the shell, `/pair` and `/api/*` on one Worker, Cloudflare Access guarding
// `/pair` only, and a service worker answering pages from the cache. Each rule
// here is one an app got wrong on its own; see the README.

/** Where a device pairs: the one path Access guards. */
export const pairPath = "/pair";

/**
 * Where a page opened at `/pair` is sent: the app, told it is back from the
 * Access login and can pair now. A fetch Access redirects cannot log in, so the
 * app opens `/pair` as a page, which comes back here once logged in.
 */
export const loginReturnPath = "/?login";

/**
 * The shell every page is answered with; the app routes from there. It is `/`,
 * where the manifest starts, and not `/index.html`: the assets server answers
 * that one with a redirect, and a redirect is no answer to a page.
 */
export const shellPath = "/";

/**
 * Paths only the network answers. `/api/*` and `/pair` are the Worker
 * speaking; `/cdn-cgi/*` is Cloudflare's, where Access's login callback sets
 * its cookie. A shell answered there instead leaves the login without one.
 */
export function networkOnly(pathname) {
  return pathname === pairPath || pathname.startsWith("/api/") || pathname.startsWith("/cdn-cgi/");
}

/**
 * The cached path the service worker answers a request with, or null when only
 * the network can: another origin, a network-only path, or an asset not in
 * this build. Every page on the origin is the shell.
 */
export function cachedFor(asked, assets) {
  const { origin, pathname } = new URL(asked.url);
  if (origin !== asked.origin || networkOnly(pathname)) return null;
  if (asked.navigation) return shellPath;
  return assets.includes(pathname) ? pathname : null;
}

/**
 * Raised when Access sends the pairing to its login: only a page can log in,
 * so the app opens `/pair` as one.
 */
export class LoginNeededError extends Error {
  constructor() {
    super("Log in to pair this device");
    this.name = "LoginNeededError";
  }
}

/**
 * The app's `/pair` call. Access answers a device not logged in with a
 * redirect to its login on another origin; followed, that fails as CORS, which
 * reads as being offline. Held back, it reads as what it is.
 */
export async function fetchPairing(request, origin) {
  const response = await request(`${origin}${pairPath}`, { redirect: "manual" });
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new LoginNeededError();
  }
  return response;
}

/**
 * The Worker's answer to a page opened at `/pair`, which is the way back from
 * the Access login: on to the app, which pairs. Null for the app's own fetch,
 * which the Worker answers with the secret. A page asks for HTML; a fetch
 * asks for anything.
 */
export function pairPageRedirect(request) {
  if (!(request.headers.get("accept") ?? "").includes("text/html")) return null;
  return new Response(null, { status: 303, headers: { location: loginReturnPath, "cache-control": "no-store" } });
}

/**
 * Whether this page load is the app coming back from the Access login, which
 * it then pairs. Puts `/` back in the address bar, so a reload is no second
 * return.
 */
export function cameBackFromLogin(window) {
  const back = window.location.pathname + window.location.search === loginReturnPath;
  if (back) window.history.replaceState(null, "", shellPath);
  return back;
}
