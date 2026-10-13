// Stub replacement for `virtual:opencode-server`.
//
// The real implementation is opencode's server bundle, built from source at
// `thirdparty/opencode/packages/opencode/dist/node/node.js`. That source tree
// is not vendored in this repository, so a fresh checkout cannot build the AI
// runtime. When the bundle is missing, `electron.vite.config.ts` resolves
// `virtual:opencode-server` to this file instead, which lets the desktop app
// start and be tested without the AI agent runtime.
//
// Behaviour:
//   - `Log.init()` is a no-op.
//   - `Server.listen()` starts a minimal local HTTP server that answers the
//     health probe (`GET /global/health`) so the main process's readiness
//     check succeeds. Every other request returns 501 Not Implemented.
//
// As a result, AI chat / agent features are non-functional (the renderer will
// receive 501 responses), while all local-only features (editor, links,
// graph, PDF, images, themes, settings) work normally.

import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

export const Log = {
  async init(_opts?: {
    level?: "DEBUG" | "INFO" | "WARN" | "ERROR";
    print?: boolean;
    dev?: boolean;
  }): Promise<void> {
    // no-op
  },
};

export const Server = {
  async listen(opts: {
    port: number;
    hostname: string;
    mdns?: boolean;
    mdnsDomain?: string;
    cors?: string[];
  }): Promise<{
    hostname: string;
    port: number;
    url: URL;
    stop(close?: boolean): Promise<void>;
  }> {
    const hostname = opts.hostname || "127.0.0.1";
    const port = opts.port ?? 0;

    const httpServer: HttpServer = createServer((req, res) => {
      if (req.url === "/global/health" || req.url?.startsWith("/global/health?")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ healthy: true, stub: true }));
        return;
      }
      res.writeHead(501, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: "opencode runtime is stubbed",
          detail:
            "The opencode server bundle is missing; AI features are disabled. " +
            "Build thirdparty/opencode or remove the AI agent module.",
          path: req.url,
        }),
      );
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, hostname, () => resolve());
    });

    const address = httpServer.address() as AddressInfo | null;
    const actualPort = address?.port ?? port;

    return {
      hostname,
      port: actualPort,
      url: new URL(`http://${hostname}:${actualPort}`),
      stop: () =>
        new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
        }),
    };
  },
};
