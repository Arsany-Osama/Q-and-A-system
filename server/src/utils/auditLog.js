import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function logChanges (userId, action, entityType, entityId) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entityType,
                entityId: parseInt(entityId)
            }
        })
    } catch (err) {
        console.log(err);
        throw new Error('Error while logging changes');
    }
}