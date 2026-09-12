/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Where the game server lives, for deployments that split the static client
   * from the server (e.g. Vercel + Render). Accepts an origin or a full socket
   * URL: https://deep-sea.onrender.com or wss://deep-sea.onrender.com/ws.
   * Left unset in development, where Vite proxies /ws to localhost.
   */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
