import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  cachedFor,
  cameBackFromLogin,
  fetchPairing,
  LoginNeededError,
  loginReturnPath,
  pairPageRedirect,
  shellPath,
} from "../pwa/index.js";
import { checkLive } from "../pwa/live.js";

const origin = "https://app.example";
const assets = ["/", "/app.js", "/styles.css"];
const asked = (path: string, navigation = false) => ({ url: `${origin}${path}`, origin, navigation });

describe("what the service worker answers from the cache", () => {
  test("a page is the shell, wherever it was asked for", () => {
    assert.equal(cachedFor(asked("/", true), assets), shellPath);
    assert.equal(cachedFor(asked("/recipes/anything?x=1", true), assets), shellPath);
  });

  test("an asset of this build reads from the cache under its own path", () => {
    assert.equal(cachedFor(asked("/app.js"), assets), "/app.js");
    assert.equal(cachedFor(asked("/styles.css?v=2"), assets), "/styles.css");
    assert.equal(cachedFor(asked("/nothing.js"), assets), null);
  });

  test("the Worker, Cloudflare and another origin answer for themselves", () => {
    assert.equal(cachedFor(asked("/api/snapshot"), assets), null);
    assert.equal(cachedFor(asked("/pair", true), assets), null);
    assert.equal(
      cachedFor(asked("/cdn-cgi/access/authorized?nonce=x", true), assets),
      null,
      "Access's login callback reaches Cloudflare, or the login never sets its cookie",
    );
    assert.equal(cachedFor({ url: "https://www.youtube.com/embed/x", origin, navigation: true }, assets), null);
  });
});

describe("pairing behind Access", () => {
  test("a pairing Access redirects to its login is told to log in, not a failed fetch", async () => {
    const request = async (_input: string, init: RequestInit) => {
      assert.equal(init.redirect, "manual", "a followed redirect lands on another origin and fails as CORS");
      return Response.redirect("https://team.cloudflareaccess.com/cdn-cgi/access/login", 302);
    };
    await assert.rejects(() => fetchPairing(request, origin), LoginNeededError);
  });

  test("a pairing the Worker answers comes back as its answer", async () => {
    const response = await fetchPairing(async (input) => Response.json({ input }), origin);
    assert.deepEqual(await response.json(), { input: `${origin}/pair` });
  });

  test("a page opened at `/pair` goes back to the app; the app's fetch gets the Worker's answer", () => {
    const page = pairPageRedirect(new Request(`${origin}/pair`, { headers: { accept: "text/html,*/*;q=0.8" } }));
    assert.equal(page?.status, 303);
    assert.equal(page?.headers.get("location"), loginReturnPath);
    assert.equal(page?.headers.get("cache-control"), "no-store");
    assert.equal(pairPageRedirect(new Request(`${origin}/pair`)), null);
  });

  test("the app knows it came back from the login, once", () => {
    const replaced: string[] = [];
    const window = (path: string, search: string) => ({
      location: { pathname: path, search },
      history: { replaceState: (_data: unknown, _unused: string, url: string) => replaced.push(url) },
    });
    assert.equal(cameBackFromLogin(window("/", "?login")), true);
    assert.deepEqual(replaced, ["/"], "a reload is no second return");
    assert.equal(cameBackFromLogin(window("/", "")), false);
    assert.equal(cameBackFromLogin(window("/recipes", "?login")), false);
  });
});

/** A deployed app as someone not logged in sees it, with Access guarding `guarded`. */
async function deployed(guarded: (path: string) => boolean): Promise<Server> {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://x").pathname;
    if (guarded(path)) {
      response.writeHead(302, { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/app?kid=1" });
    } else response.writeHead(path.startsWith("/api/") ? 401 : 200);
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

const url = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

describe("pwa-check, after a deploy", () => {
  test("passes Access on `/pair` only", async () => {
    const server = await deployed((path) => path === "/pair");
    const results = await checkLive(url(server));
    server.close();
    assert.deepEqual(results.filter((result) => !result.ok), []);
  });

  test("fails Access on the whole site, naming the service worker", async () => {
    const server = await deployed(() => true);
    const results = await checkLive(url(server));
    server.close();
    assert.deepEqual(
      results.filter((result) => !result.ok).map((result) => result.path),
      ["/", "/sw.js", "/api/live-check"],
    );
  });

  test("fails no Access at all", async () => {
    const server = await deployed(() => false);
    const results = await checkLive(url(server));
    server.close();
    assert.deepEqual(results.filter((result) => !result.ok).map((result) => result.path), ["/pair"]);
  });

  test("the command exits 1 on a failure and says what to fix", async () => {
    const server = await deployed(() => true);
    const child = spawn(process.execPath, [join(import.meta.dirname, "../pwa/cli.js"), url(server)]);
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (out += chunk));
    const code = await new Promise((resolve) => child.on("close", resolve));
    server.close();
    assert.equal(code, 1);
    assert.match(out, /FAIL \/sw\.js: 302 → https:\/\/team\.cloudflareaccess\.com/);
    assert.match(out, /`\/pair` only/);
  });
});
