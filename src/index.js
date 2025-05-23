export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // Apply security headers to all responses
    const securityHeaders = {
      "Content-Security-Policy": "default-src 'self'",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    };

    // CORS handling
    const corsHeaders = (() => {
      const origin = request.headers.get("Origin");
      // Get allowed origins from environment, defaulting to secure empty value
      const allowedOriginsList = (env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);
      
      // For tests with explicit wildcard, use wildcard directly
      if (env.ALLOWED_ORIGINS === '*') {
        return {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
          "Access-Control-Max-Age": "86400"
        };
      }
      
      // Check if the requesting origin is in our allowed list
      const isAllowed = origin && allowedOriginsList.some(allowedOrigin => {
        // Exact match case
        if (allowedOrigin === origin) return true;
        
        // Wildcard subdomain case (*.example.com)
        if (allowedOrigin.startsWith("*.") && origin) {
          try {
            const domain = new URL(origin).hostname;
            const wildcardDomain = allowedOrigin.substring(2);
            return domain === wildcardDomain || domain.endsWith("." + wildcardDomain);
          } catch (e) {
            return false;
          }
        }
        
        return false;
      });
      
      // Set allowed origin based on match result
      const accessControlAllowOrigin = isAllowed ? origin : null;
      
      return {
        ...(accessControlAllowOrigin ? { "Access-Control-Allow-Origin": accessControlAllowOrigin } : {}),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin" // Important when returning specific origins
      };
    })();

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, ...securityHeaders }
      });
    }

    if (request.method === "POST") {
      // Get auth token from environment variable
      const AUTH_TOKEN = env.AUTH_TOKEN;
      if (!AUTH_TOKEN) {
        console.error("AUTH_TOKEN not configured in environment");
        return new Response("Server configuration error", { 
          status: 500,
          headers: securityHeaders
        });
      }

      // Validate auth header using secure comparison
      const authHeader = request.headers.get("X-Auth-Token");
      if (!authHeader || !timingSafeEqual(authHeader, AUTH_TOKEN)) {
        return new Response("Unauthorized", { 
          status: 401,
          headers: securityHeaders 
        });
      }

      try {
        const { target } = await request.json();
        
        // Strict URL validation with additional security checks
        if (!isValidUrl(target)) {
          return new Response("Invalid target URL", { 
            status: 400,
            headers: { ...securityHeaders, ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Use a more secure ID generation
        const id = generateSecureId(8);
        
        // Add timestamp and rate limiting info
        const metadata = {
          createdAt: new Date().toISOString(),
          createdBy: request.headers.get("CF-Connecting-IP") || "unknown"
        };
        
        await env.LINKS.put(id, JSON.stringify({
          target,
          metadata
        }));

        return new Response(JSON.stringify({ short: `${url.origin}/${id}` }), {
          headers: { ...securityHeaders, ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Error creating short URL:", e);
        return new Response(JSON.stringify({ error: "Bad Request" }), { 
          status: 400,
          headers: { ...securityHeaders, ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Handle link redirection
    try {
      const linkData = await env.LINKS.get(path, { type: "json" });
      
      if (linkData) {
        // Validate URL again before redirect for extra security
        if (isValidUrl(linkData.target)) {
          return Response.redirect(linkData.target, 302);
        } else {
          console.error("Invalid stored URL detected:", linkData.target);
          return new Response("Invalid redirect URL", { 
            status: 400,
            headers: securityHeaders
          });
        }
      }
    } catch (e) {
      console.error("Error retrieving URL:", e);
    }

    return new Response("Not found", { 
      status: 404,
      headers: securityHeaders
    });
  },
  
};

// Helper functions
// Helper function for secure string comparison to prevent timing attacks
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// Generate a cryptographically stronger random ID
function generateSecureId(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use crypto API when available for better randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += characters[values[i] % characters.length];
    }
  } else {
    // Fallback to Math.random (less secure)
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
  }
  
  return result;
}

// Validate URL with stricter checks
function isValidUrl(string) {
  try {
    const url = new URL(string);
    const protocol = url.protocol;
    
    // Only allow https protocol (enforcing secure URLs only)
    if (protocol !== 'https:') {
      return false;
    }
    
    // Block certain top-level domains or private IP ranges if needed
    // const hostname = url.hostname;
    // if (blockedDomains.includes(hostname)) return false;
    
    return true;
  } catch (e) {
    return false;
  }
}

