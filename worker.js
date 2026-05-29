// hyrox-proxy Cloudflare Worker
// Handles: (1) CORS proxy for startlist.hyrox.com, (2) KV-based dashboard sync

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // ── Sync endpoint ─────────────────────────────────────────────────────────
    if (url.pathname === '/sync') {
      if (request.method === 'GET') {
        const data = await env.SYNC_KV.get('dashboard');
        return new Response(data || 'null', {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      if (request.method === 'POST') {
        const body = await request.text();
        await env.SYNC_KV.put('dashboard', body);
        return new Response('{"ok":true}', {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── CORS proxy ────────────────────────────────────────────────────────────
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400, headers: CORS });
    }
    try {
      const resp = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      const body = await resp.arrayBuffer();
      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'text/html; charset=utf-8',
          ...CORS,
        },
      });
    } catch (err) {
      return new Response('Proxy error: ' + err.message, { status: 502, headers: CORS });
    }
  },
};
