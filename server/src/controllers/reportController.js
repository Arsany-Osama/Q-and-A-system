const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const report = async (req, res) => {
    const { id, reason, type } = req.body;

    if (!id || !reason || !type) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    //vadlidate the type of the id
    const parsedId = parseInt(id);    if (isNaN(parsedId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    if (!["question", "answer"].includes(type.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid type' });
    }

    let data = {
        reason,
        user: {
            connect: { id: req.user.id }
        }
    };

    if (type === "question") {
        data.question = {
            connect: { id: parsedId }
        };
    } else if (type === "answer") {
        data.answer = {
            connect: { id: parsedId }
        };
    }

    try {
        await prisma.report.create({ data });
        return res.status(201).json({ success: true, message: 'Report submitted successfully' });
    } catch (error) {
        console.error('Error reporting:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getReports = async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                user: true,
                question: true,
                answer: true
            }
        });

        // Group reports by state for better organization
        const groupedReports = {
            PENDING: reports.filter(r => r.state === 'PENDING'),
            APPROVED: reports.filter(r => r.state === 'APPROVED'),
            REJECTED: reports.filter(r => r.state === 'REJECTED')
        };

        return res.status(200).json({ 
            success: true, 
            reports: groupedReports,
            totalCount: reports.length
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const deleteReportedAnswerOrQuestion = async (req, res) => {
    const {reportId} = req.body;
    
    try {
        const report = await prisma.report.findUnique({
            where: {
                id: reportId
            }
        });
        
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        
        // Start a transaction to ensure all operations succeed or fail together
        await prisma.$transaction(async (tx) => {
            // First update report state to APPROVED before any deletions
            await tx.report.update({
                where: {
                    id: reportId
                },
                data: {
                    state: "APPROVED"
                }
            });

            // Check if it was a reported question or answer
            if (report.questionId) {
                // First delete all replies to answers to avoid foreign key constraint violations
                await tx.reply.deleteMany({
                    where: {
                        answer: {
                            questionId: report.questionId
                        }
                    }
                });

                // Then delete all associated answers
                await tx.answer.deleteMany({
                    where: {
                        questionId: report.questionId
                    }
                });

                // Finally delete the question
                await tx.question.delete({
                    where: {
                        id: report.questionId
                    }
                });
            }
            else if (report.answerId) {
                // First delete all replies to this answer
                await tx.reply.deleteMany({
                    where: {
                        answerId: report.answerId
                    }
                });

                // Then delete the answer
                await tx.answer.delete({
                    where: {
                        id: report.answerId
                    }
                });
            } else {
                throw new Error('Invalid report: no question or answer found');
            }
        });
        
        return res.status(200).json({ 
            success: true, 
            message: report.questionId ? 'Reported question and its answers removed successfully' : 'Reported answer removed successfully'
        });
    } catch (error) {
        console.error('Error deleting reported content:', error);
        return res.status(500).json({ 
            success: false, 
            message: error.message === 'Invalid report: no question or answer found' 
                ? error.message 
                : 'Server error'
        });
    }
}

const RejectReport = async (req, res) => {
    const { reportId } = req.body;

    try {
        const report = await prisma.report.findUnique({
            where: {
                id: reportId
            }
        });
        
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        
        await prisma.report.update({
            where: {
                id: reportId
            },
            data: {
                state: "REJECTED"
            }
        });

        return res.status(200).json({ success: true, message: 'Report rejected successfully' });
    } catch (error) {
        console.error('Error rejecting report:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

module.exports = {
    report,
    getReports,
    deleteReportedAnswerOrQuestion,
    RejectReport
};