export declare const pairPath: "/pair";
export declare const loginReturnPath: "/?login";
export declare const shellPath: "/";

/** A request as the service worker's rule reads it. */
export interface Asked {
  url: string;
  /** The origin that serves the shell, `/pair` and `/api/*`. */
  origin: string;
  /** A page asked for, rather than something a page asks for. */
  navigation: boolean;
}

export declare function networkOnly(pathname: string): boolean;
export declare function cachedFor(asked: Asked, assets: string[]): string | null;

export declare class LoginNeededError extends Error {
  constructor();
}

export declare function fetchPairing(
  request: (input: string, init: RequestInit) => Promise<Response>,
  origin: string,
): Promise<Response>;

export declare function pairPageRedirect(request: Request): Response | null;

export declare function cameBackFromLogin(window: {
  location: { pathname: string; search: string };
  history: { replaceState(data: unknown, unused: string, url: string): void };
}): boolean;
