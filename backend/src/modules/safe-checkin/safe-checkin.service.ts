import prisma from '../../config/database';
import { generateCheckInId } from '../../utils/id-generator';
import { auditService, AuditActions } from '../audit/audit.service';
import type { CreateSafeCheckinInput } from './safe-checkin.validation';

export const safeCheckinService = {
  async createCheckIn(data: CreateSafeCheckinInput, userId: string, pseudonym: string) {
    const checkInId = generateCheckInId();

    await prisma.safeCheckIn.create({
      data: {
        checkInId,
        personName: data.personName,
        phoneNumber: data.phoneNumber,
        location: data.location as object,
        statusMessage: data.statusMessage,
        affectedFamilyMembers: data.affectedFamilyMembers ?? [],
        senderPseudonym: pseudonym,
      },
    });

    await auditService.log({
      actor: userId,
      action: AuditActions.SAFE_CHECKIN_SUBMITTED,
      resource: 'SafeCheckIn',
      resourceId: checkInId,
      metadata: { personName: data.personName },
    });

    return {
      success: true,
      checkInId,
    };
  },
};
