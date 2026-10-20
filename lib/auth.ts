import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is missing in production.");
    }
    return "bizmate-super-secret-jwt-key-2026";
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface TokenPayload {
  userId: string;
  email: string;
  businessName: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Resolves the signed-in user's id from a request, or null if there isn't a valid one.
// Callers must return 401 on null — never fall back to "the first user in the database" or
// auto-create a demo account, that would let an unauthenticated request read/write someone
// else's real financial data.
export function requireUserId(request: Request): string | null {
  return getUserFromRequest(request)?.userId ?? null;
}

export function getUserFromRequest(request: Request): TokenPayload | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const verified = verifyToken(token);
    if (verified) return verified;
  }

  // Cookie fallback (e.g. browser page navigation, SSR, or standard GET requests)
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)bizmate_token=([^;]+)/);
    if (match?.[1]) {
      const verified = verifyToken(decodeURIComponent(match[1]));
      if (verified) return verified;
    }
  }

  return null;
}
