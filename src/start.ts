import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: string; message?: string; cause?: unknown };
  if (
    err.name === "AbortError" ||
    err.code === "ABORT_ERR" ||
    err.code === "ECONNRESET" ||
    (typeof err.message === "string" &&
      (err.message.includes("This operation was aborted") ||
        err.message.includes("The user aborted a request") ||
        err.message.includes("aborted")))
  ) {
    return true;
  }
  if (err.cause) return isAbortError(err.cause);
  return false;
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    // 1. Ignore browser/client request aborts (e.g., navigation during racing/heartbeat)
    if (isAbortError(error) || request?.signal?.aborted) {
      return new Response(null, { status: 204 });
    }

    // 2. Let redirects, Response instances, and typed server-function errors bubble cleanly
    if (
      error instanceof Response ||
      (error != null &&
        typeof error === "object" &&
        ("statusCode" in error || "status" in error || "isSerializedError" in error))
    ) {
      throw error;
    }

    // 3. Do not wrap `/_serverFn` RPC calls in an HTML 500 error page; let TanStack Start
    // serialize the error or return a structured JSON payload to the client.
    const url = request?.url ?? "";
    if (url.includes("_serverFn")) {
      throw error;
    }

    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
