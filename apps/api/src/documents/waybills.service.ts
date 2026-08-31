import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { MISSION_EVENT_TYPES } from '../missions/mission.constants';
import { WaybillShareTarget, type ShareWaybillDto } from './dto/share-waybill.dto';

@Injectable()
export class WaybillsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(principal: AuthenticatedPrincipal, missionId: string) {
    const mission = await this.findMission(principal, missionId);
    const issued = await this.prisma.missionEvent.findFirst({ where: { organizationId: principal.organizationId,
      missionId, eventType: MISSION_EVENT_TYPES.waybillIssued }, orderBy: { occurredAt: 'desc' } });
    return issued?.payload ?? this.snapshot(mission, 'DRAFT', null, null);
  }

  async issue(principal: AuthenticatedPrincipal, missionId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`WAYBILL:${principal.organizationId}:${missionId}`}, 0))`;
      const existing = await tx.missionEvent.findFirst({ where: { organizationId: principal.organizationId,
        missionId, eventType: MISSION_EVENT_TYPES.waybillIssued }, orderBy: { occurredAt: 'desc' } });
      if (existing) {
        const existingSnapshot = this.safeObject(existing.payload);
        if (this.safeString(existingSnapshot.verificationToken)) return existing.payload;
        const upgradedAt = new Date();
        const upgradedPayload = {
          ...existingSnapshot,
          verificationToken: randomBytes(32).toString('base64url'),
        };
        await tx.missionEvent.create({ data: { organizationId: principal.organizationId, missionId,
          actorUserId: principal.userId, eventType: MISSION_EVENT_TYPES.waybillIssued,
          occurredAt: upgradedAt, payload: upgradedPayload } });
        await tx.auditLog.create({ data: { organizationId: principal.organizationId,
          actorUserId: principal.userId, entityType: 'Mission', entityId: missionId,
          action: 'waybill.qr_assigned', newValues: { assignedAt: upgradedAt.toISOString() } } });
        return upgradedPayload;
      }
      const mission = await this.findMission(principal, missionId, tx);
      if (!mission.driver || !mission.vehicle || !mission.carrier)
        throw new ConflictException('Driver, vehicle, and carrier assignment is required before issuing a waybill');
      const issuedAt = new Date();
      const payload = this.snapshot(
        mission,
        'ISSUED',
        issuedAt,
        principal.userId,
        randomBytes(32).toString('base64url'),
      );
      await tx.missionEvent.create({ data: { organizationId: principal.organizationId, missionId,
        actorUserId: principal.userId, eventType: MISSION_EVENT_TYPES.waybillIssued, occurredAt: issuedAt, payload } });
      await tx.auditLog.create({ data: { organizationId: principal.organizationId, actorUserId: principal.userId,
        entityType: 'Mission', entityId: missionId, action: 'waybill.issued',
        newValues: { waybillNumber: `WB-${mission.missionNo}`, issuedAt: issuedAt.toISOString() } } });
      return payload;
    });
  }

  async verify(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Waybill verification unavailable');
    }
    const issued = await this.prisma.missionEvent.findFirst({
      where: {
        eventType: MISSION_EVENT_TYPES.waybillIssued,
        payload: { path: ['verificationToken'], equals: token },
      },
      include: {
        mission: {
          select: {
            status: true,
            documents: {
              where: { type: 'POD' },
              select: { verificationStatus: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!issued || !issued.payload || typeof issued.payload !== 'object' || Array.isArray(issued.payload)) {
      throw new NotFoundException('Waybill verification unavailable');
    }
    const snapshot = issued.payload as Record<string, unknown>;
    const newer = await this.prisma.missionEvent.findFirst({
      where: {
        organizationId: issued.organizationId,
        missionId: issued.missionId,
        eventType: MISSION_EVENT_TYPES.waybillIssued,
        occurredAt: { gt: issued.occurredAt },
      },
      select: { id: true },
    });
    const completedStatuses = new Set([
      'DELIVERED',
      'OPERATIONALLY_CLOSED',
      'ACCOUNTING_READY',
      'CLOSED',
    ]);
    const verificationStatus = newer
      ? 'SUPERSEDED'
      : issued.mission.status === 'CANCELLED'
        ? 'CANCELLED'
        : completedStatuses.has(issued.mission.status)
          ? 'COMPLETED'
          : 'VALID';
    const times = this.safeObject(snapshot.times);
    const receipt = this.safeObject(snapshot.receipt);
    return {
      verificationStatus,
      waybillNumber: this.safeString(snapshot.waybillNumber),
      issueDate: this.safeString(snapshot.issuedAt),
      client: this.safeString(snapshot.client),
      source: this.safeString(snapshot.source),
      destination: this.safeString(snapshot.consignee),
      driverName: this.safeString(snapshot.driverName),
      vehicleNumber: this.safeString(snapshot.vehicleNumber),
      carrier: this.safeString(snapshot.carrier),
      typeOfGoods: this.safeString(snapshot.typeOfGoods),
      missionReference: this.safeString(snapshot.missionNo),
      departureTime: this.safeString(times.exit),
      arrivalTime: this.safeString(times.arrival),
      deliveryTime: this.safeString(receipt.receivedAt),
      waybillStatus: this.safeString(snapshot.status),
      tripStatus: issued.mission.status,
      deliveryProofStatus: issued.mission.documents[0]?.verificationStatus ?? 'NOT_AVAILABLE',
      closureStatus: this.closureStatus(issued.mission.status),
    };
  }

  async share(principal: AuthenticatedPrincipal, missionId: string, input: ShareWaybillDto) {
    const mission = await this.findMission(principal, missionId);
    const issued = await this.prisma.missionEvent.findFirst({ where: { organizationId: principal.organizationId,
      missionId, eventType: MISSION_EVENT_TYPES.waybillIssued } });
    if (!issued) throw new ConflictException('Only an issued waybill can be shared');
    if (input.target === WaybillShareTarget.DRIVER && !mission.driver?.userId)
      throw new ConflictException('The assigned driver does not have a linked portal account');
    const payload = { waybillNumber: `WB-${mission.missionNo}`, target: input.target,
      targetUserId: input.target === WaybillShareTarget.DRIVER ? mission.driver?.userId : null, clientId: mission.clientId };
    await this.prisma.$transaction([
      this.prisma.missionEvent.create({ data: { organizationId: principal.organizationId, missionId,
        actorUserId: principal.userId, eventType: MISSION_EVENT_TYPES.waybillShared, payload } }),
      this.prisma.auditLog.create({ data: { organizationId: principal.organizationId, actorUserId: principal.userId,
        entityType: 'Mission', entityId: missionId, action: 'waybill.shared', newValues: payload } }),
    ]);
    return { shared: true, target: input.target };
  }

  private async findMission(principal: AuthenticatedPrincipal, missionId: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma) {
    const grants = principal.grants.filter((g) => g.permission === 'document.read' || g.permission === 'document.upload');
    const organizationAccess = grants.some((g) => g.scopeType === 'ORGANIZATION');
    const clientIds = grants.filter((g) => g.scopeType === 'CLIENT').map((g) => g.scopeId);
    const access: Prisma.MissionWhereInput = organizationAccess ? {} : clientIds.length
      ? { clientId: { in: clientIds } } : { driver: { userId: principal.userId } };
    const mission = await db.mission.findFirst({ where: { id: missionId, organizationId: principal.organizationId, ...access },
      include: { client: { select: { name: true } }, warehouse: { select: { name: true, address: true } },
        carrier: { select: { name: true } }, vehicle: { select: { plateNo: true, vehicleType: true } },
        driver: { select: { userId: true, name: true, nationalId: true, phone: true } },
        route: { select: { name: true, cityRegion: true } },
        stops: { orderBy: { sequence: 'asc' }, include: { branch: { select: { name: true, address: true } } } } } });
    if (!mission) throw new NotFoundException('Authorized mission waybill not found');
    return mission;
  }

  private snapshot(
    mission: Awaited<ReturnType<WaybillsService['findMission']>>,
    status: 'DRAFT' | 'ISSUED',
    issuedAt: Date | null,
    preparedByUserId: string | null,
    verificationToken: string | null = null,
  ) {
    const destination = mission.stops.at(-1);
    const arrival = mission.stops.find((stop) => stop.actualArrival)?.actualArrival;
    const receipt = [...mission.stops].reverse().find((stop) => stop.unloadingCompletedAt);
    return { status, waybillNumber: `WB-${mission.missionNo}`, issuedAt: issuedAt?.toISOString() ?? null,
      verificationToken,
      preparedByUserId, date: (issuedAt ?? mission.createdAt).toISOString(), missionNo: mission.missionNo,
      client: mission.client.name, source: mission.warehouse.name, sourceAddress: mission.warehouse.address,
      consignee: destination?.branch.name ?? null, destinationAddress: destination?.branch.address ?? null,
      route: mission.route?.name ?? null, city: mission.route?.cityRegion ?? null, carrier: mission.carrier?.name ?? null,
      driverName: mission.driver?.name ?? null, driverNationalId: mission.driver?.nationalId ?? null,
      driverPhone: mission.driver?.phone ?? null, vehicleNumber: mission.vehicle?.plateNo ?? null,
      vehicleType: mission.vehicle?.vehicleType ?? null, freightValue: null, typeOfGoods: mission.cargoType ?? null,
      notes: mission.notes ?? null, times: { arrival: arrival?.toISOString() ?? null,
        loaded: mission.actualLoadingAt?.toISOString() ?? null, exit: mission.actualDepartureAt?.toISOString() ?? null, breaks: null },
      receipt: { receivedAt: receipt?.unloadingCompletedAt?.toISOString() ?? null, receiverName: null },
      declaration: { ar: 'المحتويات المشار إليها أعلاه تقع على مسؤولية الشاحن البحري ولا مسؤولية على الناقل وعدد الطرود والمحتويات ذكرت أعلاه حسب تصريح الشاحن ولا يشكل مسؤولية على الناقل البري',
        en: 'Particulars above declared by shippers and no liability attaches here with whatsoever.' },
      insuranceNote: { ar: 'الأسعار المتفق عليها لا تشمل قيمة التأمين', en: 'The rates agreed exclude the insurance cost' } };
  }

  private safeObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private safeString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private closureStatus(status: string) {
    if (status === 'CLOSED') return 'CLOSED';
    if (status === 'ACCOUNTING_READY') return 'ACCOUNTING_READY';
    if (status === 'OPERATIONALLY_CLOSED') return 'OPERATIONALLY_CLOSED';
    return 'OPEN';
  }
}
