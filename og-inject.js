// Netlify Edge Function — OG tag injection for blog posts
// Intercepts /blog.html?post=X requests before serving the static HTML,
// fetches the post from Supabase and injects correct og:image / og:title
// so LinkedIn, WhatsApp and other crawlers see the right preview.

const SUPABASE_URL  = 'https://ktjsocalyzrpmaokxhzn.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0anNvY2FseXpycG1hb2t4aHpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NzY0NDEsImV4cCI6MjA4NzQ1MjQ0MX0.u44UYJRz72y3EeUNQ9acGw_4Ejl5jlNtHKEfyGUaKVI';
const SITE_URL      = 'https://pesquisadorasdoes.com.br';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function queryPost(filter, headers, select) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_posts?${filter}&select=${select}&limit=1`,
    { headers }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function fetchPost(ref) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: 'application/json',
  };

  // Full select (works once foto_capa/foto_header columns exist)
  const fullSelect  = 'id,titulo,resumo,foto_capa,foto_header,slug';
  // Safe select (only guaranteed base columns, for resilience)
  const safeSelect  = 'id,titulo,resumo,slug';

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);

  // Build filters
  const slugFilter = `slug=eq.${encodeURIComponent(ref)}`;
  const idFilter   = `id=eq.${encodeURIComponent(ref)}`;

  // 1. Try the primary filter with full select
  const primaryFilter = isUuid ? idFilter : slugFilter;
  let post = await queryPost(primaryFilter, headers, fullSelect);

  // 2. If full select failed (column missing), retry with safe select
  if (!post) {
    post = await queryPost(primaryFilter, headers, safeSelect);
  }

  // 3. For slug-based refs, also try as UUID id (in case user shared UUID URL)
  if (!post && !isUuid) {
    post = await queryPost(idFilter, headers, fullSelect)
        || await queryPost(idFilter, headers, safeSelect);
  }

  // 4. For UUID refs, also try as slug (edge case)
  if (!post && isUuid) {
    post = await queryPost(slugFilter, headers, fullSelect)
        || await queryPost(slugFilter, headers, safeSelect);
  }

  return post || null;
}

export default async function handler(request, context) {
  const url     = new URL(request.url);
  const postRef = url.searchParams.get('post');

  // No post param → serve the blog list page normally
  if (!postRef) return context.next();

  // Fetch original HTML and post data in parallel
  const [response, post] = await Promise.all([
    context.next(),
    fetchPost(postRef).catch(() => null),
  ]);

  // Post not found → serve original page unchanged
  if (!post) return response;

  let html = await response.text();

  const postSlug    = post.slug || post.id;
  const postUrl     = `${SITE_URL}/blog.html?post=${postSlug}`;
  const title       = `${post.titulo} — Pesquisadoras ES`;
  const description = post.resumo || 'Artigo do blog Pesquisadoras ES';
  // Use foto_capa, fall back to foto_header, then to the default image
  const image = post.foto_capa || post.foto_header || DEFAULT_IMAGE;

  const ogBlock = `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${esc(postUrl)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Pesquisadoras ES">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">`;

  // Strip existing <title> and og:/twitter: static tags, inject dynamic block
  html = html
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<meta\s[^>]*property="og:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s[^>]*name="twitter:[^"]*"[^>]*\/?>/gi, '')
    .replace(/<meta\s[^>]*name="description"[^>]*\/?>/gi, '')
    .replace('<head>', `<head>${ogBlock}`);

  return new Response(html, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
