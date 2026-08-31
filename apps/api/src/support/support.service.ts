import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import type { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import type { AddSupportMessageDto } from './dto/add-support-message.dto';
import type { AssignSupportTicketDto } from './dto/assign-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthenticatedPrincipal) {
    return this.prisma.supportTicket.findMany({
      where: this.ticketWhere(principal), include: this.relations,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(principal: AuthenticatedPrincipal, input: CreateSupportTicketDto) {
    const mission = await this.prisma.mission.findFirst({
      where: { id: input.missionId, organizationId: principal.organizationId, driver: { userId: principal.userId } },
      select: { id: true, clientId: true, driverId: true },
    });
    if (!mission?.driverId) throw new NotFoundException('Assigned driver mission not found');
    const driverId = mission.driverId;
    await this.requireAttachment(principal, input.attachmentDocumentId, mission.id);
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({ data: {
        organizationId: principal.organizationId, missionId: mission.id, clientId: mission.clientId,
        driverId, subject: input.subject.trim(),
      }});
      await tx.supportMessage.create({ data: { ticketId: ticket.id, authorUserId: principal.userId,
        body: input.message.trim(), attachmentDocumentId: input.attachmentDocumentId } });
      await tx.auditLog.create({ data: { organizationId: principal.organizationId, actorUserId: principal.userId,
        entityType: 'SupportTicket', entityId: ticket.id, action: 'support.ticket_created', newValues: { missionId: mission.id } } });
      return tx.supportTicket.findUniqueOrThrow({ where: { id: ticket.id }, include: this.relations });
    });
  }

  async message(principal: AuthenticatedPrincipal, id: string, input: AddSupportMessageDto) {
    const ticket = await this.find(principal, id);
    await this.requireAttachment(principal, input.attachmentDocumentId, ticket.missionId);
    const isDriver = await this.isDriver(principal, ticket.driverId);
    const message = await this.prisma.supportMessage.create({ data: { ticketId: id, authorUserId: principal.userId,
      body: input.message.trim(), internalOnly: isDriver ? false : Boolean(input.internalOnly), attachmentDocumentId: input.attachmentDocumentId } });
    return message;
  }

  async assign(principal: AuthenticatedPrincipal, id: string, input: AssignSupportTicketDto) {
    await this.find(principal, id);
    const user = await this.prisma.user.findFirst({ where: { id: input.assignedToUserId, organizationId: principal.organizationId, status: 'ACTIVE' } });
    if (!user) throw new NotFoundException('Active support employee not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.supportAssignment.updateMany({ where: { ticketId: id, endedAt: null }, data: { endedAt: new Date() } });
      await tx.supportAssignment.create({ data: { ticketId: id, assignedToUserId: user.id, assignedByUserId: principal.userId, reason: input.reason?.trim() } });
      const ticket = await tx.supportTicket.update({ where: { id }, data: { assignedToUserId: user.id, status: 'IN_PROGRESS' } });
      await tx.auditLog.create({ data: { organizationId: principal.organizationId, actorUserId: principal.userId,
        entityType: 'SupportTicket', entityId: id, action: 'support.assignment_changed', newValues: { assignedToUserId: user.id } } });
      return ticket;
    });
  }

  private ticketWhere(principal: AuthenticatedPrincipal): Prisma.SupportTicketWhereInput {
    const grants = principal.grants.filter((g) => g.permission === 'support.read');
    if (grants.some((g) => g.scopeType === 'ORGANIZATION')) return { organizationId: principal.organizationId };
    const clientIds = grants.filter((g) => g.scopeType === 'CLIENT').map((g) => g.scopeId);
    if (clientIds.length) return { organizationId: principal.organizationId, clientId: { in: clientIds } };
    return { organizationId: principal.organizationId, driver: { userId: principal.userId } };
  }
  private async find(principal: AuthenticatedPrincipal, id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id, ...this.ticketWhere(principal) } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }
  private async isDriver(principal: AuthenticatedPrincipal, driverId: string) {
    return Boolean(await this.prisma.driver.findFirst({ where: { id: driverId, userId: principal.userId } }));
  }
  private async requireAttachment(principal: AuthenticatedPrincipal, documentId: string | undefined, missionId: string) {
    if (!documentId) return;
    if (!await this.prisma.document.findFirst({ where: { id: documentId, missionId, organizationId: principal.organizationId, mimeType: { in: ['image/jpeg', 'image/png'] } } }))
      throw new NotFoundException('Image attachment not found');
  }
  private readonly relations = { assignedTo: { select: { id: true, name: true } }, messages: { where: { internalOnly: false }, include: { author: { select: { id: true, name: true } }, attachment: { select: { id: true, originalFileName: true, mimeType: true } } }, orderBy: { createdAt: 'asc' as const } }, assignmentHistory: { include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { assignedAt: 'asc' as const } } } as const;
}
