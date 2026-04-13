/**
 * url(path) — prefix an absolute site-relative path with Astro's configured
 * `base`. Use for every internal href so preview builds (served under a
 * sub-path) and prod builds (served at root) both resolve correctly.
 *
 *   url('/teaching')         -> '/teaching'                            (base='/')
 *   url('/teaching')         -> '/music-sustech-preview.github.io/teaching'
 *                                                                      (base='/music-sustech-preview.github.io/')
 *   url('https://ex.com/x')  -> 'https://ex.com/x'     (external, left alone)
 */
export function url(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + path;
}
