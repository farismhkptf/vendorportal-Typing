import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      _custodyUser?: User;
    }
  }
}

const loginRateMap = new Map<string, { count: number; resetAt: number; blockedUntil: number }>();
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 60 * 1000;
const LOGIN_BLOCK_DURATION = 5 * 60 * 1000;

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  const now = Date.now();
  const entry = loginRateMap.get(ip);

  if (entry && now < entry.blockedUntil) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return res.status(429).json({ message: `Too many login attempts. Try again in ${retryAfter} seconds.` });
  }

  if (entry && now > entry.resetAt) {
    loginRateMap.delete(ip);
  }

  next();
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const entry = loginRateMap.get(ip) || { count: 0, resetAt: now + LOGIN_RATE_WINDOW, blockedUntil: 0 };
  entry.count++;
  if (entry.count >= LOGIN_RATE_LIMIT) {
    entry.blockedUntil = now + LOGIN_BLOCK_DURATION;
  }
  loginRateMap.set(ip, entry);
}

export function clearFailedLogins(ip: string) {
  loginRateMap.delete(ip);
}

// Attempt to verify a JWT against multiple secrets (dual-secret verification).
// Tries SHARED_JWT_SECRET (cross-portal tokens) first, then JWT_SECRET (app-specific tokens).
// Returns the decoded payload, or null if no secret accepts the token.
// Used by general auth middleware so either secret can authenticate API calls.
export function verifyJwtMultiSecret(token: string): { email?: string; sub?: string } | null {
  const secrets = [
    process.env.SHARED_JWT_SECRET,
    process.env.JWT_SECRET,
  ].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret) as { email?: string; sub?: string };
    } catch {
      // Try next secret
    }
  }
  return null;
}

// Verify a JWT against SHARED_JWT_SECRET only.
// Used by cross-portal SSO endpoints where only Client Portal tokens should be accepted.
export function verifySharedJwtOnly(token: string): { email?: string; sub?: string } | null {
  const secret = process.env.SHARED_JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as { email?: string; sub?: string };
  } catch {
    return null;
  }
}

// Verify a Bearer JWT (using dual-secret) and return the matching local staff user.
// Returns null if no secret is configured, the token is invalid, or no user matches.
async function resolveJwtUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = verifyJwtMultiSecret(token);
  if (!payload) return null;
  const email = payload.email || payload.sub;
  if (!email || !email.includes("@")) return null;
  try {
    const user = await storage.getUserByEmail(email);
    if (!user || !user.active || user.role === "Vendor") return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) return next();
  // Fall back to Bearer JWT when no session (e.g. machine-to-machine from Client Portal)
  const jwtUser = await resolveJwtUser(req);
  if (jwtUser) {
    req.session.userId = jwtUser.id;
    req.session.userRole = jwtUser.role;
    req.session.userName = jwtUser.name;
    req.session.staffId = jwtUser.staffId || null;
    return next();
  }
  return res.status(401).json({ message: "Not authenticated" });
}

export function requireVendorAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.vendorUserId) {
    return res.status(401).json({ message: "Vendor authentication required" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      // Fall back to Bearer JWT
      const jwtUser = await resolveJwtUser(req);
      if (jwtUser) {
        req.session.userId = jwtUser.id;
        req.session.userRole = jwtUser.role;
        req.session.userName = jwtUser.name;
        req.session.staffId = jwtUser.staffId || null;
      } else {
        return res.status(401).json({ message: "Not authenticated" });
      }
    }
    const user = await storage.getUser(req.session.userId!);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

export const requireOpsRole = requireRole("Admin", "Client Relationship Manager");

export async function requireTypingVendor(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.vendorUserId) {
    return res.status(401).json({ message: "Vendor authentication required" });
  }
  const vendorId = req.session?.vendorId;
  if (!vendorId) return res.status(403).json({ message: "Typing vendor access required" });
  const vendor = await storage.getVendorById(vendorId);
  if (!vendor || vendor.vendorType !== "Typing") {
    return res.status(403).json({ message: "Typing vendor access required" });
  }
  next();
}

export async function requireAttestationVendor(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.vendorUserId) {
    return res.status(401).json({ message: "Vendor authentication required" });
  }
  const vendorId = req.session?.vendorId;
  if (!vendorId) return res.status(403).json({ message: "Attestation vendor access required" });
  const vendor = await storage.getVendorById(vendorId);
  if (!vendor || vendor.vendorType !== "Attestation") {
    return res.status(403).json({ message: "Attestation vendor access required" });
  }
  next();
}

const docCustodyAllowedRoles = ["Admin", "Client Relationship Manager", "PRO", "PRO - Temporary"];

export function requireDocCustodyRole(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
  storage.getUser(req.session.userId).then(user => {
    if (!user || !docCustodyAllowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    req._custodyUser = user;
    next();
  }).catch((err) => { console.error("[auth] custody auth check failed:", err); res.status(500).json({ message: "Auth check failed" }); });
}
