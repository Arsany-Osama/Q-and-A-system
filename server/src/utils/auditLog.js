const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function logChanges(userId, action, entityType, entityId) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entityType,
                entityId: parseInt(entityId)
            }
        });
    } catch (err) {
        console.error(err);
        throw new Error('Error while logging changes');
    }
}

module.exports = logChanges;
