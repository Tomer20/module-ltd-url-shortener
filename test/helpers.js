/**
 * Test helpers for the URL Shortener project
 */

// Helper for creating consistent Request objects in tests
export function createTestRequest(path = '/', method = 'GET', headers = {}, body = null) {
  const url = `https://example.com${path}`;
  const opts = { method, headers: new Headers(headers) };
  
  if (body) {
    opts.body = JSON.stringify(body);
    if (!opts.headers.has('Content-Type')) {
      opts.headers.set('Content-Type', 'application/json');
    }
  }
  
  return new Request(url, opts);
}

// Helper to check if response has all required security headers
export function hasSecurityHeaders(response) {
  const requiredHeaders = [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy'
  ];
  
  return requiredHeaders.every(header => response.headers.has(header));
}

// Helper to validate the structure of the stored URL data
export function isValidStoredUrlData(data) {
  // Must have target property that's a valid URL
  if (!data.target || typeof data.target !== 'string') {
    return false;
  }
  
  try {
    new URL(data.target);
  } catch (e) {
    return false;
  }
  
  // Must have metadata object
  if (!data.metadata || typeof data.metadata !== 'object') {
    return false;
  }
  
  // Metadata must have createdAt property that's a valid ISO date
  if (!data.metadata.createdAt) {
    return false;
  }
  
  try {
    new Date(data.metadata.createdAt);
  } catch (e) {
    return false;
  }
  
  // Metadata must have createdBy property
  if (!data.metadata.createdBy || typeof data.metadata.createdBy !== 'string') {
    return false;
  }
  
  return true;
}

// Helper for generating mock URL data with consistent format
export function createMockUrlData(target = 'https://example.com', createdBy = '127.0.0.1') {
  return {
    target,
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy
    }
  };
}