import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../src';
import { createTestRequest, hasSecurityHeaders, isValidStoredUrlData, createMockUrlData } from './helpers';

// Mock environment for testing
const mockEnv = {
  AUTH_TOKEN: 'test-auth-token',
  ALLOWED_ORIGINS: '*',
  LINKS: {
    put: vi.fn(),
    get: vi.fn(),
  }
};

describe('URL Shortener Worker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Authentication', () => {
    it('returns 401 without auth token', async () => {
      const request = createTestRequest('/', 'POST', {}, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(401);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('returns 401 with incorrect auth token', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'wrong-token' }, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(401);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('allows requests with correct auth token', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      expect(mockEnv.LINKS.put).toHaveBeenCalled();
      expect(hasSecurityHeaders(response)).toBe(true);
    });
  });
  
  describe('URL Creation', () => {
    it('returns 400 for invalid URL', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'invalid-url' });
      const ctx = createExecutionContext();
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(400);
      expect(mockEnv.LINKS.put).not.toHaveBeenCalled();
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('returns 400 for non-http(s) protocols', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'ftp://example.com' });
      const ctx = createExecutionContext();
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(400);
      expect(mockEnv.LINKS.put).not.toHaveBeenCalled();
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('returns short URL for valid target URL', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      expect(hasSecurityHeaders(response)).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty('short');
      expect(data.short).toMatch(/^https:\/\/example\.com\/[a-zA-Z0-9]{8}$/);
      
      // Verify KV storage has correct format
      expect(mockEnv.LINKS.put).toHaveBeenCalledTimes(1);
      const kvCall = mockEnv.LINKS.put.mock.calls[0];
      expect(kvCall[0]).toMatch(/^[a-zA-Z0-9]{8}$/); // ID format
      
      // Parse stored value to check format
      const storedValue = JSON.parse(kvCall[1]);
      expect(isValidStoredUrlData(storedValue)).toBe(true);
      expect(storedValue.target).toBe('https://example.com');
    });
    
    it('handles malformed JSON in request body', async () => {
      // Create request with malformed JSON
      const request = new Request('https://example.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 
          'X-Auth-Token': 'test-auth-token'
        },
        body: '{invalid-json'
      });
      
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(400);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
  });
  
  describe('URL Redirection', () => {
    it('returns 404 for non-existent short URL', async () => {
      const request = createTestRequest('/nonexistent');
      const ctx = createExecutionContext();
      mockEnv.LINKS.get.mockResolvedValue(null);
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(404);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('redirects to stored URL', async () => {
      const request = createTestRequest('/abc123');
      const ctx = createExecutionContext();
      
      // Important: When using { type: "json" } in the KV get,
      // Cloudflare automatically parses the JSON for us before returning
      mockEnv.LINKS.get.mockImplementation((key, options) => {
        // Check if we're requesting JSON parsing
        if (options && options.type === "json") {
          return Promise.resolve({
            target: 'https://example.com',
            metadata: {
              createdAt: new Date().toISOString(),
              createdBy: '127.0.0.1'
            }
          });
        }
        // Regular string return
        return Promise.resolve(JSON.stringify({
          target: 'https://example.com',
          metadata: {
            createdAt: new Date().toISOString(),
            createdBy: '127.0.0.1'
          }
        }));
      });
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(302);
      // URL normalization adds a trailing slash when redirecting
      expect(response.headers.get('Location')).toBe('https://example.com/');
    });
    
    it('returns 400 if stored URL is invalid on redirect', async () => {
      const request = createTestRequest('/abc123');
      const ctx = createExecutionContext();
      
      // Mock the auto-parsed JSON response for invalid URL
      mockEnv.LINKS.get.mockImplementation((key, options) => {
        if (options && options.type === "json") {
          return Promise.resolve({
            target: 'javascript:alert(1)', // Malicious URL that somehow got stored
            metadata: {
              createdAt: new Date().toISOString(),
              createdBy: '127.0.0.1'
            }
          });
        }
        return Promise.resolve(null);
      });
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(400);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('handles KV error gracefully', async () => {
      const request = createTestRequest('/error-path');
      const ctx = createExecutionContext();
      mockEnv.LINKS.get.mockRejectedValue(new Error('KV storage error'));
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(404);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
    
    it('handles malformed JSON in KV storage', async () => {
      const request = createTestRequest('/corrupt-data');
      const ctx = createExecutionContext();
      
      // Simulate a parse error from KV's built-in JSON parsing
      const mockError = new SyntaxError('Unexpected token in JSON');
      mockEnv.LINKS.get.mockRejectedValue(mockError);
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      // The implementation returns 404 for missing URLs and error cases
      expect(response.status).toBe(404);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
  });
  
  describe('Security Headers', () => {
    it('includes security headers in responses', async () => {
      const request = createTestRequest('/');
      const ctx = createExecutionContext();
      mockEnv.LINKS.get.mockResolvedValue(null);
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(response.headers.get('Permissions-Policy')).toBeTruthy();
    });
    
    it('handles CORS preflight requests', async () => {
      const request = createTestRequest('/', 'OPTIONS');
      const ctx = createExecutionContext();
      
      const response = await worker.fetch(request, mockEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy();
    });
  });

  // New test for missing AUTH_TOKEN
  describe('Server Configuration', () => {
    it('returns 500 when AUTH_TOKEN is not configured', async () => {
      const request = createTestRequest('/', 'POST', {}, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      
      // Create env without AUTH_TOKEN
      const envWithoutToken = {
        ...mockEnv,
        AUTH_TOKEN: null
      };
      
      const response = await worker.fetch(request, envWithoutToken, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(500);
      expect(hasSecurityHeaders(response)).toBe(true);
    });
  });
  
  // New test suite for CORS handling
  describe('CORS Handling', () => {
    // Add a new test for when ALLOWED_ORIGINS is not defined
    it('handles undefined ALLOWED_ORIGINS gracefully', async () => {
      const request = createTestRequest('/', 'POST', { 
        'X-Auth-Token': 'test-auth-token',
        'Origin': 'https://example.com'
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Mock environment with undefined ALLOWED_ORIGINS
      const undefinedOriginEnv = {
        ...mockEnv,
        ALLOWED_ORIGINS: undefined
      };
      
      const response = await worker.fetch(request, undefinedOriginEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull(); // No CORS header for undefined origin
      expect(response.headers.get('Vary')).toBe('Origin');
    });
    
    it('handles specific allowed origins correctly', async () => {
      const request = createTestRequest('/', 'POST', { 
        'X-Auth-Token': 'test-auth-token',
        'Origin': 'https://trusted.example.com'
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Mock environment with specific allowed origins
      const specificOriginEnv = {
        ...mockEnv,
        ALLOWED_ORIGINS: 'https://trusted.example.com,*.trusted-domain.com'
      };
      
      const response = await worker.fetch(request, specificOriginEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://trusted.example.com');
      expect(response.headers.get('Vary')).toBe('Origin');
    });
    
    it('handles wildcard domain patterns in allowed origins', async () => {
      const request = createTestRequest('/', 'POST', { 
        'X-Auth-Token': 'test-auth-token',
        'Origin': 'https://sub.trusted-domain.com'
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Mock environment with wildcard domain pattern
      const wildcardOriginEnv = {
        ...mockEnv,
        ALLOWED_ORIGINS: 'https://trusted.example.com,*.trusted-domain.com'
      };
      
      const response = await worker.fetch(request, wildcardOriginEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://sub.trusted-domain.com');
      expect(response.headers.get('Vary')).toBe('Origin');
    });
    
    it('blocks disallowed origins', async () => {
      const request = createTestRequest('/', 'POST', { 
        'X-Auth-Token': 'test-auth-token',
        'Origin': 'https://attacker.com'
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Mock environment with specific allowed origins
      const specificOriginEnv = {
        ...mockEnv,
        ALLOWED_ORIGINS: 'https://trusted.example.com,*.trusted-domain.com'
      };
      
      const response = await worker.fetch(request, specificOriginEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200); // Still returns 200 for valid requests
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull(); // No CORS header for disallowed origin
      expect(response.headers.get('Vary')).toBe('Origin');
    });
    
    it('handles invalid origin URL gracefully in wildcard check', async () => {
      const request = createTestRequest('/', 'POST', { 
        'X-Auth-Token': 'test-auth-token',
        'Origin': 'invalid-url'
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Mock environment with wildcard domain pattern
      const wildcardOriginEnv = {
        ...mockEnv,
        ALLOWED_ORIGINS: 'https://trusted.example.com,*.trusted-domain.com'
      };
      
      const response = await worker.fetch(request, wildcardOriginEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(200); // Still processes the request
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull(); // No CORS header for invalid origin
      expect(response.headers.get('Vary')).toBe('Origin');
    });
  });

  // Test for crypto fallback in ID generation
  describe('Secure ID Generation', () => {
    it('generates IDs properly when crypto is available', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Save original crypto
      const originalCrypto = global.crypto;
      
      // Mock crypto to verify it's being used
      global.crypto = {
        getRandomValues: vi.fn(array => {
          // Fill with predictable values for testing
          for (let i = 0; i < array.length; i++) {
            array[i] = i * 10;
          }
          return array;
        })
      };
      
      try {
        const response = await worker.fetch(request, mockEnv, ctx);
        await waitOnExecutionContext(ctx);
        
        expect(response.status).toBe(200);
        expect(global.crypto.getRandomValues).toHaveBeenCalled();
        
        // The exact ID will depend on the mapping of the predictable values to characters
        // So we just check that an ID was generated and stored
        expect(mockEnv.LINKS.put).toHaveBeenCalledTimes(1);
        
      } finally {
        // Restore original crypto
        global.crypto = originalCrypto;
      }
    });
    
    it('falls back to Math.random when crypto is unavailable', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Save original crypto and Math.random
      const originalCrypto = global.crypto;
      const originalRandom = Math.random;
      
      // Remove crypto
      global.crypto = undefined;
      
      // Mock Math.random
      Math.random = vi.fn(() => 0.5); // Always return 0.5 for predictable testing
      
      try {
        const response = await worker.fetch(request, mockEnv, ctx);
        await waitOnExecutionContext(ctx);
        
        expect(response.status).toBe(200);
        expect(Math.random).toHaveBeenCalled();
        expect(mockEnv.LINKS.put).toHaveBeenCalledTimes(1);
        
      } finally {
        // Restore originals
        global.crypto = originalCrypto;
        Math.random = originalRandom;
      }
    });

    it('generates IDs properly when crypto is available but without getRandomValues', async () => {
      const request = createTestRequest('/', 'POST', { 'X-Auth-Token': 'test-auth-token' }, { target: 'https://example.com' });
      const ctx = createExecutionContext();
      mockEnv.LINKS.put.mockResolvedValue(undefined);
      
      // Save original crypto and Math.random
      const originalCrypto = global.crypto;
      const originalRandom = Math.random;
      
      // Mock crypto without getRandomValues
      global.crypto = {};
      
      // Mock Math.random
      Math.random = vi.fn(() => 0.5);
      
      try {
        const response = await worker.fetch(request, mockEnv, ctx);
        await waitOnExecutionContext(ctx);
        
        expect(response.status).toBe(200);
        expect(Math.random).toHaveBeenCalled();
        expect(mockEnv.LINKS.put).toHaveBeenCalledTimes(1);
        
      } finally {
        // Restore originals
        global.crypto = originalCrypto;
        Math.random = originalRandom;
      }
    });
  });

  // New test suite for helper functions
  describe('Helper Functions', () => {
    it('timingSafeEqual handles different string lengths', async () => {
      // Create a test request for authentication to trigger timingSafeEqual
      const request = createTestRequest('/', 'POST', { 
        'X-Auth-Token': 'short-token' 
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      
      // Mock environment with longer token
      const testEnv = {
        ...mockEnv,
        AUTH_TOKEN: 'longer-auth-token'
      };
      
      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      // The function should return false for different length strings
      expect(response.status).toBe(401);
    });
    
    it('timingSafeEqual handles non-string inputs', async () => {
      // Create a test request for authentication to trigger timingSafeEqual with a non-string value
      const request = createTestRequest('/', 'POST', { 
        // The header will be interpreted as a string by the browser,
        // but we can modify the environment to use a non-string value
      }, { target: 'https://example.com' });
      
      const ctx = createExecutionContext();
      
      // Mock environment with non-string token (null)
      const testEnv = {
        ...mockEnv,
        AUTH_TOKEN: null
      };
      
      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      // This should trigger the server error path since AUTH_TOKEN is null
      expect(response.status).toBe(500);
    });
    
    it('timingSafeEqual directly tests non-string input', async () => {
      // To directly test timingSafeEqual with non-string inputs, we need to modify the source code
      // to export the function or we can use a different approach:
      // Create a request with a header that the worker can't parse as a string
      
      // Create a request with numeric token (will be converted to string by Headers)
      const request = new Request('https://example.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 123 // Will be converted to string by Headers API
        }
      });
      
      // We'll use a special environment with a number as AUTH_TOKEN
      // We know internally that timingSafeEqual will be called with "123" and 123
      // which should trigger the type check condition
      const testEnv = {
        ...mockEnv,
        AUTH_TOKEN: 123 // Numeric value will be different type than string header
      };
      
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, testEnv, ctx);
      await waitOnExecutionContext(ctx);
      
      // Since types don't match, authentication should fail
      expect(response.status).toBe(401);
    });
  });
});
