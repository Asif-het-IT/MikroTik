export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    }

    const reqId = crypto.randomUUID();
    const now = new Date().toISOString();

    let payload = {};
    try {
      payload = await parsePayload(request);
    } catch (err) {
      return json({ ok: false, code: 'BAD_PAYLOAD', reqId, ts: now, error: String(err) }, 400);
    }

    const token = String(payload.token || payload.t || request.headers.get('X-Token') || '').trim();
    if (!token || token !== String(env.ROUTER_TOKEN || '').trim()) {
      return json({ ok: false, code: 'AUTH_FAIL', reqId, ts: now }, 401);
    }

    const appScriptUrlRaw = String(env.APPS_SCRIPT_URL || '').trim();
    // Hard fail if env is not the exact /exec URL.
    if (!appScriptUrlRaw || !appScriptUrlRaw.includes('/exec')) {
      return json({
        ok: false,
        code: 'BAD_CONFIG',
        reqId,
        ts: now,
        detail: 'APPS_SCRIPT_URL must be the Web App /exec URL.'
      }, 500);
    }

    const dedupeSec = Math.max(1, Number(env.DEDUPE_SEC || 20));
    const dedupeKey = await buildDedupeKey(payload);
    const dedupeReq = new Request(`https://dedupe.local/${dedupeKey}`);

    const cached = await caches.default.match(dedupeReq);
    if (cached) {
      return json({ ok: true, code: 'DEDUPED', reqId, ts: now, proxy: 'CF' }, 200);
    }

    const forwardMethod = request.method;
    const flat = flattenPayload(payload);

    let upstreamRes;
    if (forwardMethod === 'GET') {
      const u = new URL(appScriptUrlRaw);
      for (const [k, v] of Object.entries(flat)) u.searchParams.set(k, v);
      upstreamRes = await fetch(u.toString(), {
        method: 'GET',
        redirect: 'follow',
        cf: { cacheTtl: 0, cacheEverything: false }
      });
    } else {
      // For POST, forward as classic x-www-form-urlencoded
      // (Apps Script Web App handles this reliably).
      upstreamRes = await fetch(appScriptUrlRaw, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Token': token,
          'X-Req-Id': reqId
        },
        body: new URLSearchParams(flat).toString(),
        redirect: 'follow',
        cf: { cacheTtl: 0, cacheEverything: false }
      });
    }

    const upstreamText = await upstreamRes.text();

    ctx.waitUntil(
      caches.default.put(
        dedupeReq,
        new Response('1', {
          headers: { 'Cache-Control': `public, max-age=${dedupeSec}` }
        })
      )
    );

    const adminMode = String(flat.admin || '').toLowerCase();
    const upstreamPreview = adminMode === 'status'
      ? upstreamText.slice(0, 50000)
      : upstreamText.slice(0, 300);

    return json(
      {
        ok: upstreamRes.ok,
        status: upstreamRes.status,
        proxy: 'CF',
        reqId,
        ts: now,
        upstream: upstreamPreview
      },
      upstreamRes.ok ? 200 : 502
    );
  }
};

async function parsePayload(request) {
  const ctype = (request.headers.get('content-type') || '').toLowerCase();

  if (request.method === 'GET') {
    const u = new URL(request.url);
    const params = new URLSearchParams(u.search);

    // Accept malformed path style like /token=...&type=live from strict clients.
    if (![...params.keys()].length) {
      const rawPath = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
      if (rawPath.includes('=') && rawPath.includes('&')) {
        const fixed = new URLSearchParams(rawPath);
        for (const [k, v] of fixed.entries()) params.set(k, v);
      }
    }

    return Object.fromEntries(params.entries());
  }

  if (ctype.includes('application/json')) {
    return await request.json();
  }

  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text).entries());
}

function flattenPayload(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload || {})) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  }
  return out;
}

async function buildDedupeKey(payload) {
  const copy = { ...payload };
  delete copy.ts;
  delete copy.time;
  delete copy._ts;

  const base = Object.keys(copy)
    .sort()
    .map((k) => `${k}=${String(copy[k])}`)
    .join('&');

  return (await sha1(base)).slice(0, 24);
}

async function sha1(input) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
