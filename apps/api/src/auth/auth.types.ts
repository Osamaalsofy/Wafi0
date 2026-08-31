import type { ScopeType } from '../../generated/prisma/client';

export interface AccessTokenPayload {
  sub: string;
  organizationId: string;
}

export interface AuthorizationGrant {
  permission: string;
  scopeType: ScopeType;
  scopeId: string;
}

export interface AuthenticatedPrincipal {
  userId: string;
  organizationId: string;
  email: string;
  grants: AuthorizationGrant[];
}
