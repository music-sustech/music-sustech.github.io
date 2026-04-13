# Sveltia CMS OAuth Broker (Deno Deploy)

A minimal OAuth broker that lets Sveltia CMS (or Decap CMS) authenticate
editors with GitHub. Deployed on Deno Deploy.

## How it works

1. Editor clicks "Login with GitHub" in the CMS.
2. CMS opens `/auth` on the broker, which redirects to GitHub's OAuth
   authorize page.
3. GitHub redirects back to `/callback` with a temporary code.
4. The broker exchanges the code for an access token using the client secret,
   then returns a small HTML page that `postMessage`s the token back to the
   CMS tab and closes itself.

## Prerequisites

Create a **GitHub OAuth App** (not a GitHub App) under the `music-sustech`
org:

- **Application name:** e.g. `MUSIC Lab CMS`
- **Homepage URL:** `https://music-sustech.github.io`
- **Authorization callback URL:** `https://music-lab-oauth.deno.dev/callback`
  (replace with your actual Deno Deploy project URL)

Note the **Client ID** and generate a **Client secret**.

## Environment variables

Set these in the Deno Deploy project dashboard (Settings > Environment
Variables):

| Variable               | Description                                              |
|------------------------|----------------------------------------------------------|
| `GITHUB_CLIENT_ID`    | OAuth App client ID                                       |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret                                  |
| `ORIGIN`               | Allowed origin for postMessage, e.g. `https://music-sustech.github.io` |

## Deploy to Deno Deploy

1. Push this directory to a GitHub repo (or a subdirectory of the site repo).
2. In the [Deno Deploy dashboard](https://dash.deno.com), create a new
   project and link it to the GitHub repo.
3. Set the entrypoint to `oauth-broker/mod.ts` (or `mod.ts` if the repo
   root is this directory).
4. Add the three environment variables above.
5. Deploy. The project URL will be something like
   `https://music-lab-oauth.deno.dev`.

Deno Deploy's GitHub integration auto-deploys on every push.

## Local development

```bash
GITHUB_CLIENT_ID=xxx GITHUB_CLIENT_SECRET=yyy ORIGIN=http://localhost:4321 \
  deno task dev
```

The broker will listen on `http://localhost:8000`.

## Swap-in: Cloudflare Workers

The broker is plain `fetch()` handlers and ports to Cloudflare Workers in
about 15 minutes. Replace `Deno.serve()` with the Workers `export default`
handler and swap `Deno.env.get()` for `env` bindings. See the project
brainstorm (references/brainstorm.md) for details.
