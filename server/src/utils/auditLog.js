import prisma from '../db.js';

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
        console.error(err);
        throw new Error('Error while logging changes');
    }
}