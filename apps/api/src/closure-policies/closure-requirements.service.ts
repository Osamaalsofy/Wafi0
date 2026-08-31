import { ConflictException, Injectable } from '@nestjs/common';
import type {
  DocumentRequirementScope,
  DocumentType,
  MissionStatus,
  Prisma,
} from '../../generated/prisma/client';

export interface ClosureRequirementInput {
  documentType: DocumentType;
  scope: DocumentRequirementScope;
}

export interface VerifiedDocumentInput {
  type: DocumentType;
  stopId: string | null;
}

export interface MissingClosureRequirement extends ClosureRequirementInput {
  missingStopIds: string[];
}

export function evaluateDocumentRequirements(
  requirements: ClosureRequirementInput[],
  stops: Array<{ id: string }>,
  documents: VerifiedDocumentInput[],
): MissingClosureRequirement[] {
  return requirements.flatMap((requirement) => {
    if (requirement.scope === 'MISSION') {
      const exists = documents.some(
        (document) => document.type === requirement.documentType && document.stopId === null,
      );
      return exists ? [] : [{ ...requirement, missingStopIds: [] }];
    }
    const missingStopIds = stops
      .filter(
        (stop) =>
          !documents.some(
            (document) => document.type === requirement.documentType && document.stopId === stop.id,
          ),
      )
      .map(({ id }) => id);
    return missingStopIds.length ? [{ ...requirement, missingStopIds }] : [];
  });
}

interface ClosableMission {
  id: string;
  organizationId: string;
  clientId: string;
  stops: Array<{ id: string }>;
}

@Injectable()
export class ClosureRequirementsService {
  async assertSatisfied(
    tx: Prisma.TransactionClient,
    mission: ClosableMission,
    target: MissionStatus,
  ) {
    const stage =
      target === 'OPERATIONALLY_CLOSED'
        ? 'OPERATIONAL_CLOSURE'
        : target === 'ACCOUNTING_READY'
          ? 'ACCOUNTING_READINESS'
          : undefined;
    if (!stage) return undefined;
    const policy = await tx.closurePolicy.findFirst({
      where: {
        organizationId: mission.organizationId,
        clientId: mission.clientId,
        stage,
        status: 'ACTIVE',
      },
      include: { requirements: true },
    });
    if (!policy)
      throw new ConflictException(`No active ${stage} policy exists for this mission's client`);
    if (!policy.requirements.length) return policy.id;
    const documents = await tx.document.findMany({
      where: {
        organizationId: mission.organizationId,
        missionId: mission.id,
        verificationStatus: 'VERIFIED',
      },
      select: { type: true, stopId: true },
    });
    const [missing] = evaluateDocumentRequirements(policy.requirements, mission.stops, documents);
    if (missing)
      throw new ConflictException(
        `Missing verified ${missing.documentType} document for ${missing.scope}`,
      );
    return policy.id;
  }
}
