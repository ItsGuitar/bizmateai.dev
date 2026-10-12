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
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}
