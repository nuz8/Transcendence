/**
 * Constructs an absolute WebSocket URL matching the host and protocol
 * the current web page was loaded from.
 *
 * Example:
 *   If loaded from https://192.168.0.2/ -> wss://192.168.0.2/api/chat
 *   If loaded from http://localhost:8080/ -> ws://localhost:8080/api/chat
 */
export function getSocketUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // includes hostname and port (e.g. 192.168.0.2 or localhost:443)
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${protocol}//${host}/api${cleanPath}`;
}