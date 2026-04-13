/**
 * Sveltia / Decap CMS OAuth broker for GitHub — Deno Deploy
 *
 * Two routes:
 *   GET /auth      — redirects the user to GitHub's OAuth authorize page
 *   GET /callback  — exchanges the code for an access token, then postMessages
 *                    the token back to the CMS tab and closes itself
 *
 * Environment variables (set in Deno Deploy dashboard):
 *   GITHUB_CLIENT_ID      — from your GitHub OAuth App
 *   GITHUB_CLIENT_SECRET   — from your GitHub OAuth App
 *   ORIGIN                 — allowed origin for postMessage, e.g.
 *                            https://music-sustech.github.io
 */

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** Generate a random hex string for the OAuth state parameter. */
function randomState(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Return an HTML page that posts a message back to the opener window.
 * This is the standard Decap / Sveltia postMessage handshake.
 */
function authResultPage(
  status: "success" | "error",
  content: string,
  origin: string,
): Response {
  const message =
    status === "success"
      ? `authorization:github:success:${content}`
      : `authorization:github:error:${content}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>OAuth — ${status}</title></head>
<body>
<script>
(function () {
  var msg = ${JSON.stringify(message)};
  var origin = ${JSON.stringify(origin)};
  if (window.opener) {
    window.opener.postMessage(msg, origin);
    window.close();
  }
})();
</script>
<p>Authenticating with GitHub&hellip; this window should close automatically.</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// In-memory state store. Each entry expires after 10 minutes.
// This is sufficient for a single Deno Deploy isolate; the state parameter
// also prevents replay across isolates because GitHub will only honour the
// code once.
const pendingStates = new Map<string, number>();

function pruneStates(): void {
  const now = Date.now();
  for (const [key, ts] of pendingStates) {
    if (now - ts > 10 * 60 * 1000) pendingStates.delete(key);
  }
}

// ---------------------------------------------------------------------------
//  Request handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const clientId = Deno.env.get("GITHUB_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET") ?? "";
  const origin = Deno.env.get("ORIGIN") ?? "";

  if (!clientId || !clientSecret || !origin) {
    return new Response("Server misconfigured — missing environment variables", {
      status: 500,
    });
  }

  // ── GET /auth ──────────────────────────────────────────────────────────
  if (url.pathname === "/auth") {
    pruneStates();
    const state = randomState();
    pendingStates.set(state, Date.now());

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${url.origin}/callback`,
      scope: "repo,user",
      state,
    });

    return Response.redirect(
      `https://github.com/login/oauth/authorize?${params}`,
      302,
    );
  }

  // ── GET /callback ──────────────────────────────────────────────────────
  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Validate state to prevent CSRF
    if (!state || !pendingStates.has(state)) {
      return authResultPage("error", "Invalid or expired state parameter — please try logging in again.", origin);
    }
    pendingStates.delete(state);

    if (!code) {
      return authResultPage("error", "Missing authorization code from GitHub.", origin);
    }

    // Exchange code for access token
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      if (!tokenRes.ok) {
        return authResultPage(
          "error",
          `GitHub token exchange failed (HTTP ${tokenRes.status}).`,
          origin,
        );
      }

      const data = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (data.error || !data.access_token) {
        return authResultPage(
          "error",
          data.error_description ?? data.error ?? "Unknown GitHub error.",
          origin,
        );
      }

      // Return the token via postMessage — never via URL or logs
      return authResultPage(
        "success",
        JSON.stringify({ token: data.access_token, provider: "github" }),
        origin,
      );
    } catch (err) {
      return authResultPage("error", `Token exchange error: ${(err as Error).message}`, origin);
    }
  }

  // ── Fallback ───────────────────────────────────────────────────────────
  if (url.pathname === "/") {
    return new Response("MUSIC Lab CMS OAuth broker is running.\n", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Not found", { status: 404 });
});
