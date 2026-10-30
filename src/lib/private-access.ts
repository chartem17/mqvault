const encoder = new TextEncoder();

async function equalCredentials(actual: string, expected: string) {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function checkPrivateAccess(request: Request): Promise<Response | null> {
  const password = process.env.VAULT_ACCESS_PASSWORD;
  const headers = { "Cache-Control": "no-store" };
  if (!password || password.length < 20) {
    return new Response("Private workspace access is not configured. Set VAULT_ACCESS_PASSWORD (at least 20 characters).", { status: 503, headers });
  }
  const authorization = request.headers.get("authorization") ?? "";
  let credentials = "";
  if (authorization.length <= 4096 && authorization.startsWith("Basic ")) {
    try { credentials = atob(authorization.slice(6)); } catch { credentials = ""; }
  }
  if (!(await equalCredentials(credentials, `owner:${password}`))) {
    return new Response("Authentication required", { status: 401, headers: { ...headers, "WWW-Authenticate": "Basic realm=\"Trade Vault\", charset=\"UTF-8\"" } });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    try {
      const expected = new URL(process.env.VAULT_SITE_ORIGIN || request.url).origin;
      const origin = request.headers.get("origin");
      const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!origin || new URL(origin).origin !== expected || contentType !== "application/json") {
        return new Response("Same-origin JSON requests are required", { status: 403, headers });
      }
    } catch { return new Response("Invalid request origin", { status: 403, headers }); }
  }
  return null;
}
