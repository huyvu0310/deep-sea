/**
 * Origins allowed to reach this server, comma separated. Set this in any
 * deployment where the client is hosted elsewhere, so neither a table nor an
 * account can be driven from an arbitrary page. Left unset for local
 * development, which allows any origin.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((entry) => entry.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const allowedOrigins = ALLOWED_ORIGINS;

export function originAllowed(origin: string | undefined): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true;
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ''));
}
