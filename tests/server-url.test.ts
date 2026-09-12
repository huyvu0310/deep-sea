import { describe, expect, it } from 'vitest';
import { apiUrl, socketUrl } from '../src/ui/server-url';

describe('resolving the game server address', () => {
  it('upgrades an https origin to a wss socket url', () => {
    expect(socketUrl('https://deep-sea.onrender.com')).toBe('wss://deep-sea.onrender.com/ws');
  });

  it('accepts a plain http origin for a local or private server', () => {
    expect(socketUrl('http://192.168.1.10:8787')).toBe('ws://192.168.1.10:8787/ws');
  });

  it('leaves an address that already names the socket path alone', () => {
    expect(socketUrl('wss://deep-sea.onrender.com/ws')).toBe('wss://deep-sea.onrender.com/ws');
  });

  it('tolerates a trailing slash', () => {
    expect(socketUrl('https://deep-sea.onrender.com/')).toBe('wss://deep-sea.onrender.com/ws');
  });

  it('treats blank configuration as unset', () => {
    // Falls through to the page origin, which jsdom does not provide here; the
    // point is that it does not build a socket url out of whitespace.
    expect(() => socketUrl('   ')).toThrow();
  });
});

describe('resolving the account api address', () => {
  it('reaches the same host as the socket, over https', () => {
    expect(apiUrl('/api/auth/me', 'wss://deep-sea.onrender.com/ws')).toBe(
      'https://deep-sea.onrender.com/api/auth/me',
    );
  });

  it('accepts the server given as a plain origin', () => {
    expect(apiUrl('/api/auth/login', 'https://deep-sea.onrender.com')).toBe(
      'https://deep-sea.onrender.com/api/auth/login',
    );
  });

  it('stays on the page origin when no server is configured', () => {
    expect(apiUrl('/api/auth/me', undefined)).toBe('/api/auth/me');
  });
});
