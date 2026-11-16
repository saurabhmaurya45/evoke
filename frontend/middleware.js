const DEFAULT_APEX = 'theinvitely.in';

const RESERVED = new Set([
  'www',
  'api',
  'admin',
  'app',
  'assets',
  'backend',
  'blog',
  'cdn',
  'dashboard',
  'dev',
  'editor',
  'evoke',
  'ftp',
  'mail',
  'media',
  'preview',
  'staging',
  'static',
  'test',
  'vercel',
]);

export const config = {
  matcher: ['/((?!api/|_next/|invitation-templates/).*)'],
};

/**
 * Wedding subdomains (`couple.theinvitely.in/`) reuse the invitation-page edge handler.
 * The marketing apex and reserved labels keep normal CSR routing.
 */
export default function middleware(request) {
  const host = (request.headers.get('host') || '').split(':')[0];
  const apex = (process.env.PUBLIC_APEX_DOMAIN || DEFAULT_APEX).toLowerCase();

  if (!host || host === apex || host === `www.${apex}`) {
    return;
  }

  const suffix = `.${apex}`;
  if (!host.endsWith(suffix)) {
    return;
  }

  const label = host.slice(0, -suffix.length);
  if (!label || RESERVED.has(label)) {
    return new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const target = new URL('/api/invitation-page', request.url);
  target.searchParams.set('subdomain', label);
  return Response.rewrite(target);
}