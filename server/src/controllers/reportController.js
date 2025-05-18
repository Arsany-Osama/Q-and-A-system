const { Prisma } = require("@prisma/client")
const prisma = new PrismaClient();

export const report = async (req, res) => {
    const { id, reason, type } = req.body;

    if (!id || !reason || !type) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    //vadlidate the type of the id
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    if (!["question", "answer"].includes(type.tolowerCase())) {
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

export const getReports = async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            where:{
                state:"PENDING"
            },
            orderBy:{
                createdAt: 'desc'
            },
            include: {
                user: true,
                question: true,
                answer: true
            }
        });

        return res.status(200).json({ success: true, reports });
    } catch (error) {
        console.error('Error fetching reports:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteReportedAnswerOrQuestion = async (req, res) => {

    const {reportId} = req.body;
    try{
        const report = await prisma.report.findUnique({
            where: {
                id: reportId
            }
        });
                                    //check if it was a reported question or answer 

        if(report.questionId){
            await prisma.question.delete({
                where: {
                    id: report.questionId
                }
            });
        }
        else if(report.answerId){
            await prisma.answer.delete({
                where: {
                    id: report.answerId
                }
            });
        }
    }catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

export const RejectReport = async (req, res) => {

    const { reportId } = req.body;

    try {
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