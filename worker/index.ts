// Worker entry: `/api/*` runs here first (see `run_worker_first` in
// wrangler.jsonc); every other path is served from the Vite build in ./dist
// with the SPA fallback, exactly as before.
import { handleApi, type ApiEnv } from "./api";

interface Env extends ApiEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch (err) {
        console.error("cloud save api error", err);
        return new Response(JSON.stringify({ error: "internal" }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
