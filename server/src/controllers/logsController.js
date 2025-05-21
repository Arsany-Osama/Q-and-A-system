const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient()

const getLogs = async (req, res) => {
    try{
        const logs = await prisma.auditLog.findMany({
            orderBy: {
                createdAt: 'asc'
            },
            include: {
                user: true
            }
        });
        return res.json({ success: true, logs });
    }catch(error){
        console.error('Error fetching logs:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = { getLogs };