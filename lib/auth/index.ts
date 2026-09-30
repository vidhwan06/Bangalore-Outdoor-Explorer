// Authentication abstraction
// This allows swapping auth providers (NextAuth, Clerk, Supabase, custom, etc.)

import { user_role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: user_role;
  emailVerified: Date | null;
}

export interface AuthSession {
  user: AuthUser;
  expires: Date;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthProvider {
  // Session management
  getSession(): Promise<AuthSession | null>;
  createSession(user: AuthUser): Promise<AuthSession>;
  destroySession(): Promise<void>;

  // User management
  getUserById(id: string): Promise<AuthUser | null>;
  getUserByEmail(email: string): Promise<AuthUser | null>;
  createUser(data: {
    email: string;
    name?: string;
    avatarUrl?: string;
    password?: string;
  }): Promise<AuthUser>;
  updateUser(id: string, data: Partial<AuthUser>): Promise<AuthUser>;

  // Authentication
  authenticate(email: string, password: string): Promise<AuthUser | null>;
  authenticateWithProvider(provider: string, token: string): Promise<AuthUser | null>;

  // Authorization
  hasRole(user: AuthUser, roles: user_role[]): boolean;
  canAccess(user: AuthUser, resource: string, action: string): boolean;

  // Email verification
  sendVerificationEmail(email: string): Promise<void>;
  verifyEmail(token: string): Promise<boolean>;

  // Password reset
  sendPasswordResetEmail(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
}

export interface AuthConfig {
  provider: 'nextauth' | 'clerk' | 'supabase' | 'custom';
  secret: string;
  url: string;
  providers: AuthProviderConfig[];
  callbacks?: AuthCallbacks;
}

export interface AuthProviderConfig {
  id: string;
  name: string;
  type: 'oauth' | 'email' | 'credentials';
  options: Record<string, unknown>;
}

export interface AuthCallbacks {
  signIn?: (user: AuthUser) => Promise<boolean>;
  redirect?: (url: string, baseUrl: string) => Promise<string>;
  session?: (session: AuthSession, user: AuthUser) => Promise<AuthSession>;
  jwt?: (token: unknown, user: AuthUser) => Promise<unknown>;
}

// Role hierarchy for authorization
export const ROLE_HIERARCHY: Record<user_role, number> = {
  USER: 0,
  CONTRIBUTOR: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

export function hasMinimumRole(userRole: user_role, requiredRole: user_role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canModerate(userRole: user_role): boolean {
  return hasMinimumRole(userRole, 'MODERATOR');
}

export function canAdmin(userRole: user_role): boolean {
  return hasMinimumRole(userRole, 'ADMIN');
}

export function canContribute(userRole: user_role): boolean {
  return hasMinimumRole(userRole, 'CONTRIBUTOR');
}

// Resource-based permissions
export type Permission =
  | 'place:create'
  | 'place:read'
  | 'place:update'
  | 'place:delete'
  | 'place:verify'
  | 'trail:create'
  | 'trail:update'
  | 'condition:create'
  | 'condition:update'
  | 'community:post'
  | 'community:comment'
  | 'community:moderate'
  | 'submission:create'
  | 'submission:review'
  | 'user:manage'
  | 'badge:manage'
  | 'analytics:view';

export const ROLE_PERMISSIONS: Record<user_role, Permission[]> = {
  USER: [
    'place:read',
    'trail:create',
    'condition:create',
    'community:post',
    'community:comment',
    'submission:create',
  ],
  CONTRIBUTOR: [
    'place:read',
    'place:create',
    'place:update',
    'trail:create',
    'trail:update',
    'condition:create',
    'condition:update',
    'community:post',
    'community:comment',
    'submission:create',
  ],
  MODERATOR: [
    'place:read',
    'place:create',
    'place:update',
    'place:verify',
    'trail:create',
    'trail:update',
    'condition:create',
    'condition:update',
    'community:post',
    'community:comment',
    'community:moderate',
    'submission:create',
    'submission:review',
  ],
  ADMIN: [
    'place:read',
    'place:create',
    'place:update',
    'place:delete',
    'place:verify',
    'trail:create',
    'trail:update',
    'condition:create',
    'condition:update',
    'community:post',
    'community:comment',
    'community:moderate',
    'submission:create',
    'submission:review',
    'user:manage',
    'badge:manage',
    'analytics:view',
  ],
};

export function hasPermission(userRole: user_role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}
