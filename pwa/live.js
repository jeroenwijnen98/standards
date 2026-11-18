// What a deployed app answers someone not logged in, which is the one thing
// no test of the app can see: Access is set up in the Cloudflare dashboard.
// Guarding the whole site looks fine while a session lasts; once it expires
// `/sw.js` answers with a redirect, the browser refuses it, and the device
// stays on its old build without a word.

/** What an origin must answer someone not logged in, and why. */
const expected = [
  { path: "/", status: [200], why: "the shell loads without a login" },
  { path: "/sw.js", status: [200], why: "the service worker updates without a login; a redirect is refused" },
  { path: "/pair", status: [302, 303], access: true, why: "Access guards `/pair`, sending a page to its login" },
  { path: "/api/live-check", status: [401], why: "the API refuses a call without the secret" },
];

/** Asks each expected path once, redirects held back, and says what it found. */
export async function checkLive(origin, request = fetch) {
  const results = [];
  for (const { path, status, access, why } of expected) {
    const response = await request(`${origin}${path}`, {
      redirect: "manual",
      headers: { accept: "text/html,*/*;q=0.8" },
    });
    const location = response.headers.get("location") ?? "";
    const toAccess =
      URL.canParse(location, origin) && new URL(location, origin).hostname.endsWith(".cloudflareaccess.com");
    const ok = status.includes(response.status) && (access === true ? toAccess : true);
    const found = `${response.status}${location === "" ? "" : ` → ${location.split("?")[0]}`}`;
    results.push({ path, ok, found, why });
  }
  return results;
}
