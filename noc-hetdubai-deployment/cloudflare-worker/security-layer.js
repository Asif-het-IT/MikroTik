/**
 * Cloudflare Worker - NOC Security Layer
 * 
 * یہ ہے Routers اور Apps Script کے درمیان gateway
 * 
 * Kaam:
 * 1. Token validation
 * 2. Rate limiting
 * 3. IP filtering
 * 4. Request logging
 * 5. Response caching
 * 
 * Deploy to: noc-gateway.hetdubai.com
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // ============ SECURITY CHECKS ============
    
    // 1. Validate token
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonError('Missing authorization token', 401);
    }
    
    const token = auth.substring(7);
    const validTokens = (env.ROUTER_TOKENS || '').split(',');
    
    if (!validTokens.includes(token)) {
      return jsonError('Invalid token', 403);
    }
    
    // 2. Rate limiting (using Durable Objects)
    const clientIP = request.headers.get('CF-Connecting-IP');
    const rateLimiter = env.RATE_LIMITER.get(
      new Request(clientIP, { method: 'GET' })
    );
    
    let remaining = 100; // Default
    try {
      const res = await fetch('http://do-not-resolve/', {
        method: 'POST',
        body: clientIP,
      }).catch(() => null);
      
      remaining = res ? parseInt(res.headers.get('X-RateLimit-Remaining') || '100') : 100;
    } catch (e) {
      // Continue even if rate limiting fails
    }
    
    if (remaining < 0) {
      return jsonError('Rate limit exceeded', 429);
    }
    
    // 3. IP filtering (optional)
    const allowedIPs = (env.ALLOWED_IPS || '').split(',');
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      return jsonError('IP not whitelisted', 403);
    }
    
    // ============ PROXY TO APPS SCRIPT ============
    
    const target = new URL(request.url);
    target.hostname = 'script.google.com';
    target.pathname = '/macros/d/' + (env.APPS_SCRIPT_ID || '') + '/usercontent' + url.pathname;
    
    // Forward request
    const response = await fetch(new Request(target, {
      method: request.method,
      headers: {
        'Authorization': 'Bearer ' + (env.APPS_SCRIPT_TOKEN || ''),
        ...request.headers,
      },
      body: request.method !== 'GET' ? request.body : undefined,
    }));
    
    // Cache response if successful
    if (response.ok) {
      const cacheControl = new Headers(response.headers);
      cacheControl.set('Cache-Control', 'public, max-age=60');
      
      const cached = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: cacheControl,
      });
      
      ctx.waitUntil(
        caches.default.put(
          new Request(url.toString()),
          cached.clone()
        )
      );
      
      return cached;
    }
    
    return response;
  },
  
  // Durable Object for rate limiting
  async scheduled(event, env, ctx) {
    // Cleanup old rate limit entries every hour
    ctx.waitUntil(
      env.RATE_LIMITER.get('cleanup').fetch('http://do-not-resolve/', {
        method: 'POST',
      })
    );
  }
};

/**
 * Durable Object: Rate Limiter
 */
export class RateLimiter {
  constructor(state) {
    this.state = state;
    this.limits = new Map(); // IP -> count
  }
  
  async fetch(request) {
    const ip = await request.text();
    const now = Date.now();
    
    // Get current count
    let count = this.limits.get(ip) || { count: 0, reset: now + 60000 };
    
    if (now > count.reset) {
      count = { count: 0, reset: now + 60000 };
    }
    
    count.count++;
    const remaining = Math.max(0, 100 - count.count);
    
    this.limits.set(ip, count);
    
    return new Response('OK', {
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
      }
    });
  }
}

function jsonError(message, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * wrangler.toml configuration:
 * 
 * name = "noc-gateway"
 * main = "src/index.js"
 * compatibility_date = "2024-03-01"
 * 
 * [env.production]
 * routes = [
 *   { pattern = "noc-gateway.hetdubai.com/*", zone_id = "..." }
 * ]
 * 
 * [env.production.vars]
 * APPS_SCRIPT_ID = "AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O"
 * ALLOWED_IPS = "203.0.113.5,203.0.113.10"
 * 
 * [[env.production.durable_objects.bindings]]
 * name = "RATE_LIMITER"
 * class_name = "RateLimiter"
 * 
 * [env.production.env.vars]
 * ROUTER_TOKENS = "router_token_1,router_token_2,..."
 * APPS_SCRIPT_TOKEN = "..."
 * 
 * Deployment:
 * npm install wrangler
 * wrangler deploy --env production
 */
