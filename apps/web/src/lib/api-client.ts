const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function localizedApiMessage(message: unknown) {
  const normalized = Array.isArray(message)
    ? message.filter((item): item is string => typeof item === 'string').join('، ')
    : typeof message === 'string'
      ? message
      : 'Request failed';
  if (typeof document === 'undefined' || document.documentElement.lang !== 'ar-SA') return normalized;
  const known: Record<string, string> = {
    'Request failed': 'تعذر إكمال الطلب',
    'Unable to reach the WAFI OS API': 'تعذر الاتصال بواجهة WAFI OS',
    Unauthorized: 'انتهت الجلسة أو بيانات الدخول غير صحيحة',
    Forbidden: 'ليست لديك الصلاحية المطلوبة',
    'Active client not found': 'لم يتم العثور على عميل نشط',
    'Warehouse code already exists for this client':
      'رمز المستودع مستخدم مسبقًا لهذا العميل. استخدم رمزًا مختلفًا.',
    'Governorate not found': 'المحافظة المحددة غير موجودة',
    'Closure policy contains duplicate requirements': 'تحتوي سياسة الإغلاق على متطلبات مكررة',
    'Active closure policies are immutable; deactivate before editing':
      'السياسة النشطة غير قابلة للتعديل؛ عطّلها أولاً',
    'Route code already exists in this organization':
      'رمز المسار مستخدم مسبقًا. استخدم رمزًا مختلفًا.',
    'Active route client not found': 'العميل المحدد غير نشط أو غير موجود.',
    'Every route stop must reference an active branch for the client':
      'أحد الفروع المحددة غير نشط أو لا يتبع العميل المختار.',
    'Route stop sequences must be unique': 'ترتيب فروع المسار يحتوي على أرقام مكررة.',
    'timeZone must be a valid IANA time-zone identifier': 'المنطقة الزمنية غير صحيحة.',
    'Saudi operational routes must use Asia/Riyadh':
      'يجب استخدام المنطقة الزمنية Asia/Riyadh للمسارات السعودية.',
  };
  if (Array.isArray(message)) {
    return `تحقق من الحقول التالية: ${normalized}`;
  }
  // Do not leak an untranslated backend sentence into the Arabic interface.
  // The request id remains available on ApiRequestError for support/debugging.
  return known[normalized] ?? 'تعذر إكمال العملية. تحقق من البيانات وحاول مرة أخرى.';
}

export interface ApiFailureBody {
  statusCode?: number;
  message?: string | string[];
  details?: string[];
  requestId?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiRequestError(localizedApiMessage('Unable to reach the WAFI OS API'), 0);
  }
  const body = (await response.json().catch(() => undefined)) as ApiFailureBody | T | undefined;
  if (!response.ok) {
    const failure = body as ApiFailureBody | undefined;
    throw new ApiRequestError(
      localizedApiMessage(failure?.details ?? failure?.message ?? 'Request failed'),
      response.status,
      failure?.requestId,
    );
  }
  return body as T;
}

export interface LoginInput {
  organizationCode: string;
  email: string;
  password: string;
}

export interface AccessSession {
  accessToken: string;
  expiresIn: number;
}

export interface AuthorizationGrant {
  permission: string;
  scopeType: 'ORGANIZATION' | 'CLIENT' | 'WAREHOUSE';
  scopeId: string;
}

export interface CurrentUser {
  userId: string;
  organizationId: string;
  email: string;
  grants: AuthorizationGrant[];
}

export function login(input: LoginInput, signal?: AbortSignal) {
  return requestJson<AccessSession>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
}

export function refreshSession(signal?: AbortSignal) {
  return requestJson<AccessSession>('/auth/refresh', { method: 'POST', signal });
}

export function logoutSession() {
  return requestJson<void>('/auth/logout', { method: 'POST' });
}

export function getCurrentUser(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<CurrentUser>(accessToken, '/auth/me', signal);
}

export function getControlTower(accessToken: string, query: URLSearchParams, signal?: AbortSignal) {
  const suffix = query.size ? `?${query.toString()}` : '';
  return requestJson<import('../features/control-tower/types').ControlTowerResponse>(
    `/control-tower${suffix}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal },
  );
}

function authorizedGet<T>(accessToken: string, path: string, signal?: AbortSignal) {
  return requestJson<T>(path, { headers: { Authorization: `Bearer ${accessToken}` }, signal });
}

export function getCollection<T>(accessToken: string, path: string, signal?: AbortSignal) {
  return authorizedGet<T[]>(accessToken, path, signal);
}

function authorizedJson<T>(accessToken: string, path: string, body: unknown) {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function listResource<T>(
  accessToken: string,
  path: string,
  query: URLSearchParams,
  signal?: AbortSignal,
) {
  const suffix = query.size ? `?${query.toString()}` : '';
  return authorizedGet<{
    data: T[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>(accessToken, `${path}${suffix}`, signal);
}

export function createResource<T>(accessToken: string, path: string, body: unknown) {
  return authorizedJson<T>(accessToken, path, body);
}

export function updateResource<T>(accessToken: string, path: string, body: unknown) {
  return requestJson<T>(path, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function putResource<T>(accessToken: string, path: string, body: unknown) {
  return requestJson<T>(path, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function archiveResource<T>(accessToken: string, path: string) {
  return authorizedJson<T>(accessToken, path, {});
}

export function getUsers<T>(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<T[]>(accessToken, '/users', signal);
}
export function getRoles<T>(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<T[]>(accessToken, '/roles', signal);
}
export function getPermissions<T>(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<T[]>(accessToken, '/roles/permissions', signal);
}
export function assignUserRole(accessToken: string, userId: string, roleId: string) {
  return authorizedJson(accessToken, `/users/${userId}/roles`, { roleId });
}
export function getDailyLoading<T>(
  accessToken: string,
  query: URLSearchParams,
  signal?: AbortSignal,
) {
  return authorizedGet<T>(accessToken, `/daily-loading?${query.toString()}`, signal);
}

export function getOperationalReport<T>(
  accessToken: string,
  type: string,
  query: URLSearchParams,
  signal?: AbortSignal,
) {
  return authorizedGet<T>(
    accessToken,
    `/reports/${encodeURIComponent(type)}?${query.toString()}`,
    signal,
  );
}
export function getAuditLogs<T>(accessToken: string, page: number, signal?: AbortSignal) {
  return authorizedGet<T[]>(accessToken, `/audit-logs?page=${page}&limit=25`, signal);
}

export function getMission(accessToken: string, missionId: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/control-tower/types').MissionDetail>(
    accessToken,
    `/missions/${missionId}`,
    signal,
  );
}

export function getMissions(accessToken: string, query: URLSearchParams, signal?: AbortSignal) {
  const suffix = query.size ? `?${query.toString()}` : '';
  return authorizedGet<import('../features/missions/types').PaginatedMissions>(
    accessToken,
    `/missions${suffix}`,
    signal,
  );
}

export function getCurrentDriverMissions(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/missions/types').PaginatedMissions>(
    accessToken,
    '/missions/driver-portal/me?page=1&limit=100&sortBy=createdAt&sortOrder=desc',
    signal,
  );
}

export function createMission(
  accessToken: string,
  input: import('../features/missions/types').MissionWriteInput,
) {
  return authorizedJson<import('../features/control-tower/types').MissionDetail>(
    accessToken,
    '/missions',
    input,
  );
}

export function updateMission(
  accessToken: string,
  missionId: string,
  input: Partial<import('../features/missions/types').MissionWriteInput>,
) {
  return updateResource<import('../features/control-tower/types').MissionDetail>(
    accessToken,
    `/missions/${missionId}`,
    input,
  );
}

export function assignMission(
  accessToken: string,
  missionId: string,
  input: { carrierId: string; vehicleId: string; driverId: string },
) {
  return authorizedJson(accessToken, `/missions/${missionId}/assign`, input);
}

export function getAvailableMissionTransitions(
  accessToken: string,
  missionId: string,
  signal?: AbortSignal,
) {
  return authorizedGet<import('../features/missions/types').AvailableMissionTransitions>(
    accessToken,
    `/missions/${missionId}/available-transitions`,
    signal,
  );
}

export function transitionMission(
  accessToken: string,
  missionId: string,
  input: { toStatus: string; occurredAt?: string; reason?: string },
) {
  return authorizedJson(accessToken, `/missions/${missionId}/transition`, input);
}

export function addMissionStop(
  accessToken: string,
  missionId: string,
  input: import('../features/missions/types').MissionStopWriteInput,
) {
  return authorizedJson(accessToken, `/missions/${missionId}/stops`, input);
}

export function updateMissionStop(
  accessToken: string,
  stopId: string,
  input: Partial<import('../features/missions/types').MissionStopWriteInput>,
) {
  return updateResource(accessToken, `/mission-stops/${stopId}`, input);
}

export function recordMissionStopArrival(accessToken: string, stopId: string) {
  return authorizedJson(accessToken, `/mission-stops/${stopId}/arrive`, {});
}

export function startMissionStopUnloading(accessToken: string, stopId: string) {
  return authorizedJson(accessToken, `/mission-stops/${stopId}/start-unloading`, {});
}

export function completeMissionStop(
  accessToken: string,
  stopId: string,
  input: import('../features/missions/types').CompleteMissionStopInput,
) {
  return authorizedJson(accessToken, `/mission-stops/${stopId}/complete`, input);
}

export function getMissionEvents(
  accessToken: string,
  missionId: string,
  page = 1,
  signal?: AbortSignal,
) {
  return authorizedGet<
    import('../features/control-tower/types').PaginatedResponse<
      import('../features/control-tower/types').MissionEvent
    >
  >(accessToken, `/missions/${missionId}/events?page=${page}&limit=20`, signal);
}

export function getMissionDocuments(
  accessToken: string,
  missionId: string,
  page = 1,
  signal?: AbortSignal,
) {
  return authorizedGet<
    import('../features/control-tower/types').PaginatedResponse<
      import('../features/control-tower/types').MissionDocument
    >
  >(
    accessToken,
    `/documents?missionId=${encodeURIComponent(missionId)}&page=${page}&limit=20`,
    signal,
  );
}

export function getWaybill(accessToken: string, missionId: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/waybills/types').DigitalWaybill>(accessToken, `/waybills/missions/${missionId}`, signal);
}
export function issueWaybill(accessToken: string, missionId: string) {
  return authorizedJson<import('../features/waybills/types').DigitalWaybill>(accessToken, `/waybills/missions/${missionId}/issue`, {});
}
export function shareWaybill(accessToken: string, missionId: string, target: 'DRIVER' | 'CLIENT') {
  return authorizedJson<{ shared: true; target: string }>(accessToken, `/waybills/missions/${missionId}/share`, { target });
}
export function verifyWaybill(token: string, signal?: AbortSignal) {
  return requestJson<import('../features/waybills/types').PublicWaybillVerification>(
    `/waybills/verify/${encodeURIComponent(token)}`,
    { signal },
  );
}

export function getDocuments(accessToken: string, query: URLSearchParams, signal?: AbortSignal) {
  const suffix = query.size ? `?${query.toString()}` : '';
  return authorizedGet<import('../features/documents/types').PaginatedDocuments>(
    accessToken,
    `/documents${suffix}`,
    signal,
  );
}

export function uploadDocument(
  accessToken: string,
  input: { missionId: string; stopId?: string; type: string; file: File },
) {
  const body = new FormData();
  body.set('missionId', input.missionId);
  if (input.stopId) body.set('stopId', input.stopId);
  body.set('type', input.type);
  body.set('file', input.file);
  return requestJson<import('../features/documents/types').DocumentRecord>('/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
}

export function verifyDocument(
  accessToken: string,
  documentId: string,
  input: { status: 'VERIFIED' | 'REJECTED'; notes?: string },
) {
  return authorizedJson<import('../features/documents/types').DocumentRecord>(
    accessToken,
    `/documents/${documentId}/verify`,
    input,
  );
}

export async function getDocumentContent(
  accessToken: string,
  documentId: string,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/documents/${documentId}/content`, {
      headers: { Accept: 'application/octet-stream', Authorization: `Bearer ${accessToken}` },
      signal,
    });
  } catch {
    throw new ApiRequestError(localizedApiMessage('Unable to reach the WAFI OS API'), 0);
  }
  if (!response.ok) {
    const failure = (await response.json().catch(() => undefined)) as ApiFailureBody | undefined;
    throw new ApiRequestError(
      localizedApiMessage(failure?.message ?? 'Unable to download document'),
      response.status,
      failure?.requestId,
    );
  }
  return response.blob();
}

export function getExceptions(accessToken: string, query: URLSearchParams, signal?: AbortSignal) {
  const suffix = query.size ? `?${query.toString()}` : '';
  return authorizedGet<import('../features/exceptions/types').PaginatedExceptions>(
    accessToken,
    `/exceptions${suffix}`,
    signal,
  );
}

export function getException(accessToken: string, exceptionId: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/exceptions/types').OperationalExceptionDetail>(
    accessToken,
    `/exceptions/${exceptionId}`,
    signal,
  );
}

export function assignException(accessToken: string, exceptionId: string, ownerUserId?: string) {
  return authorizedJson(accessToken, `/exceptions/${exceptionId}/assign`, { ownerUserId });
}

export function changeExceptionSeverity(
  accessToken: string,
  exceptionId: string,
  severity?: string,
) {
  return authorizedJson(accessToken, `/exceptions/${exceptionId}/severity`, { severity });
}

export function resolveException(accessToken: string, exceptionId: string, notes: string) {
  return authorizedJson(accessToken, `/exceptions/${exceptionId}/resolve`, { notes });
}

export function addExceptionRootCause(
  accessToken: string,
  exceptionId: string,
  input: { category: string; description: string; confirmed: boolean },
) {
  return authorizedJson(accessToken, `/exceptions/${exceptionId}/root-causes`, input);
}

export function addExceptionDecision(
  accessToken: string,
  exceptionId: string,
  decisionText: string,
) {
  return authorizedJson(accessToken, `/exceptions/${exceptionId}/decisions`, { decisionText });
}

export function attachExceptionEvidence(
  accessToken: string,
  exceptionId: string,
  input: { documentId: string; purpose?: string },
) {
  return authorizedJson(accessToken, `/exceptions/${exceptionId}/evidence`, input);
}

export function addCorrectiveAction(
  accessToken: string,
  decisionId: string,
  input: { ownerUserId: string; actionText: string; dueAt?: string },
) {
  return authorizedJson(accessToken, `/decisions/${decisionId}/actions`, input);
}

export function completeCorrectiveAction(accessToken: string, actionId: string, notes?: string) {
  return authorizedJson(accessToken, `/actions/${actionId}/complete`, { notes });
}

export function getRuleConfigurations(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/rules/types').RuleConfiguration[]>(
    accessToken,
    '/rule-configurations',
    signal,
  );
}

export function getRuleConfigurationOptions(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/rules/types').RuleConfigurationOptions>(
    accessToken,
    '/rule-configurations/options',
    signal,
  );
}

export function createRuleConfiguration(
  accessToken: string,
  input: import('../features/rules/types').CreateRuleConfigurationInput,
) {
  return authorizedJson<import('../features/rules/types').RuleConfiguration>(
    accessToken,
    '/rule-configurations',
    input,
  );
}

export function getAlerts(accessToken: string, query: URLSearchParams, signal?: AbortSignal) {
  const suffix = query.size ? `?${query.toString()}` : '';
  return authorizedGet<import('../features/alerts/types').PaginatedAlerts>(
    accessToken,
    `/alerts${suffix}`,
    signal,
  );
}

export function markAlertRead(accessToken: string, alertId: string) {
  return authorizedJson<import('../features/alerts/types').OperationalAlert>(
    accessToken,
    `/alerts/${alertId}/read`,
    {},
  );
}

export function getKpiConfigurations(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/kpis/types').KpiConfiguration[]>(
    accessToken,
    '/kpi-configurations',
    signal,
  );
}

export function getKpiConfigurationOptions(accessToken: string, signal?: AbortSignal) {
  return authorizedGet<import('../features/kpis/types').KpiConfigurationOptions>(
    accessToken,
    '/kpi-configurations/options',
    signal,
  );
}

export function createKpiConfiguration(
  accessToken: string,
  input: import('../features/kpis/types').CreateKpiConfigurationInput,
) {
  return authorizedJson<import('../features/kpis/types').KpiConfiguration>(
    accessToken,
    '/kpi-configurations',
    input,
  );
}

export function getAuditContext(
  accessToken: string,
  contextType: import('../features/audit/types').AuditContextType,
  contextId: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ contextType, contextId });
  return authorizedGet<import('../features/audit/types').AuditEntry[]>(
    accessToken,
    `/audit-logs/context?${query.toString()}`,
    signal,
  );
}

export function reevaluateOperationalRules(
  accessToken: string,
  input: {
    evaluationAt: string;
    missionId?: string;
    scheduledFrom?: string;
    scheduledTo?: string;
    maxMissions: number;
  },
) {
  return authorizedJson<{
    evaluationAt: string;
    missions: number;
    timeRulesEvaluated: number;
    futureOperationsSkipped: number;
  }>(accessToken, '/rule-evaluations/reevaluate', input);
}

export function startRouteDeviation(accessToken: string, missionId: string, occurredAt: string) {
  return authorizedJson(accessToken, `/missions/${missionId}/route-deviations`, { occurredAt });
}

export function recoverRouteDeviation(
  accessToken: string,
  missionId: string,
  incidentId: string,
  returnedAt: string,
) {
  return authorizedJson(
    accessToken,
    `/missions/${missionId}/route-deviations/${incidentId}/recover`,
    { returnedAt },
  );
}
