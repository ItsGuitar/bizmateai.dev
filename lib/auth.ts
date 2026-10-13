import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "bizmate-super-secret-jwt-key-2026";

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
