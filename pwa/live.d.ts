export interface LiveResult {
  path: string;
  ok: boolean;
  /** The status, and where a redirect went. */
  found: string;
  /** What the path must answer, and why. */
  why: string;
}

export declare function checkLive(
  origin: string,
  request?: (input: string, init: RequestInit) => Promise<Response>,
): Promise<LiveResult[]>;
