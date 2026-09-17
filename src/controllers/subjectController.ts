import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Subject } from '../models/Subject';
import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Question } from '../models/Question';
import { successResponse } from '../utils/apiResponse';

export const getSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const examParam = (req.query.examSlug || req.query.examId || req.query.exam) as string | undefined;
    const stageParam = (req.query.stageSlug || req.query.stageId || req.query.stage) as string | undefined;
    const paperParam = (req.query.paperSlug || req.query.paperId || req.query.paper) as string | undefined;

    const query: any = { isActive: true };

    let targetExamDoc: any = null;

    if (examParam && typeof examParam === 'string' && examParam.trim() !== '') {
      const cleanExam = examParam.trim().toLowerCase();
      if (mongoose.Types.ObjectId.isValid(cleanExam)) {
        targetExamDoc = await Exam.findById(cleanExam);
      } else {
        targetExamDoc = await Exam.findOne({ slug: cleanExam, isActive: true });
      }

      if (!targetExamDoc) {
        // If an explicit exam was requested but doesn't exist, return empty array to prevent cross-exam leakage
        res.status(200).json(successResponse('Subjects fetched successfully', []));
        return;
      }
      query.examId = targetExamDoc._id;
    } else {
      // Default to SSC CGL to preserve backward compatibility for legacy callers
      targetExamDoc = await Exam.findOne({ slug: 'ssc-cgl', isActive: true });
      if (targetExamDoc) {
        query.examId = targetExamDoc._id;
      }
    }

    if (stageParam && typeof stageParam === 'string' && stageParam !== 'all') {
      const cleanStage = stageParam.trim().toLowerCase();
      let stageDoc: any = null;
      if (mongoose.Types.ObjectId.isValid(cleanStage)) {
        stageDoc = await ExamStage.findById(cleanStage);
      } else if (targetExamDoc) {
        stageDoc = await ExamStage.findOne({ examId: targetExamDoc._id, slug: cleanStage, isActive: true });
      }
      if (stageDoc) {
        query.stageId = stageDoc._id;
      }
    }

    if (paperParam && typeof paperParam === 'string' && paperParam !== 'all') {
      const cleanPaper = paperParam.trim().toLowerCase();
      let paperDoc: any = null;
      if (mongoose.Types.ObjectId.isValid(cleanPaper)) {
        paperDoc = await ExamPaper.findById(cleanPaper);
      } else if (targetExamDoc) {
        paperDoc = await ExamPaper.findOne({ examId: targetExamDoc._id, slug: cleanPaper, isActive: true });
      }
      if (paperDoc) {
        query.paperId = paperDoc._id;
      }
    }

    const subjects = await Subject.find(query)
      .populate('examId', 'name slug icon shortName')
      .populate('stageId', 'name slug order')
      .populate('paperId', 'name slug order')
      .lean();

    // Aggregate total questions per subject
    const subjectIds = subjects.map((s) => s._id);
    const questionCounts = await Question.aggregate([
      {
        $match: {
          subjectId: { $in: subjectIds },
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$subjectId',
          totalQuestions: { $sum: 1 },
        },
      },
    ]);

    const countsMap = new Map(questionCounts.map((q) => [q._id.toString(), q.totalQuestions]));

    const subjectsWithCounts = subjects.map((s) => ({
      ...s,
      totalQuestions: countsMap.get(s._id.toString()) || 0,
    }));

    // Sort: Stage Order (Prelims before Mains) -> Paper Order (Paper 1 before Paper 2) -> Subject Order
    subjectsWithCounts.sort((a: any, b: any) => {
      const stageA = a.stageId?.order ?? 0;
      const stageB = b.stageId?.order ?? 0;
      if (stageA !== stageB) return stageA - stageB;

      const paperA = a.paperId?.order ?? 0;
      const paperB = b.paperId?.order ?? 0;
      if (paperA !== paperB) return paperA - paperB;

      return (a.order ?? 0) - (b.order ?? 0);
    });

    res.status(200).json(successResponse('Subjects fetched successfully', subjectsWithCounts));
  } catch (error) {
    next(error);
  }
};
