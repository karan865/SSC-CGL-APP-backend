import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Exam } from '../models/Exam';
import { ExamStage } from '../models/ExamStage';
import { ExamPaper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
import { successResponse, errorResponse } from '../utils/apiResponse';

/**
 * GET /api/exams
 * Returns all active exams.
 */
export const getExams = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const exams = await Exam.find({ isActive: true }).sort({ order: 1 });
    res.status(200).json(successResponse('Exams fetched successfully', exams));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/exams/:examId/stages
 * Returns active stages for an exam. Accepts MongoDB ObjectId or slug.
 */
export const getExamStages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const examId = req.params.examId as string;
    if (!examId) {
      res.status(400).json(errorResponse('Missing examId parameter'));
      return;
    }

    let exam;
    if (mongoose.Types.ObjectId.isValid(examId)) {
      exam = await Exam.findOne({ _id: examId, isActive: true });
    } else {
      exam = await Exam.findOne({ slug: examId.toLowerCase(), isActive: true });
    }

    if (!exam) {
      res.status(404).json(errorResponse('Exam not found or is inactive'));
      return;
    }

    const stages = await ExamStage.find({ examId: exam._id, isActive: true }).sort({ order: 1 });
    res.status(200).json(successResponse('Stages fetched successfully', stages));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/stages/:stageId/papers
 * GET /api/exams/:examId/stages/:stageId/papers
 * Returns active papers for a stage. Accepts MongoDB ObjectId or slug.
 */
export const getStagePapers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stageId = req.params.stageId as string;
    const examId = req.params.examId as string | undefined;
    if (!stageId) {
      res.status(400).json(errorResponse('Missing stageId parameter'));
      return;
    }

    let stageQuery: any = { isActive: true };
    if (mongoose.Types.ObjectId.isValid(stageId)) {
      stageQuery._id = stageId;
    } else {
      stageQuery.slug = stageId.toLowerCase();
      if (examId) {
        let examObjId = examId;
        if (!mongoose.Types.ObjectId.isValid(examId)) {
          const examDoc = await Exam.findOne({ slug: examId.toLowerCase(), isActive: true });
          if (examDoc) examObjId = examDoc._id.toString();
        }
        stageQuery.examId = examObjId;
      }
    }

    const stage = await ExamStage.findOne(stageQuery);
    if (!stage) {
      res.status(404).json(errorResponse('Stage not found or is inactive'));
      return;
    }

    const papers = await ExamPaper.find({ stageId: stage._id, isActive: true }).sort({ order: 1 });
    res.status(200).json(successResponse('Papers fetched successfully', papers));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/papers/:paperId/subjects
 * Returns active subjects for a specific paper. Accepts MongoDB ObjectId or slug.
 */
export const getPaperSubjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const paperId = req.params.paperId as string;
    if (!paperId) {
      res.status(400).json(errorResponse('Missing paperId parameter'));
      return;
    }

    let paper;
    if (mongoose.Types.ObjectId.isValid(paperId)) {
      paper = await ExamPaper.findOne({ _id: paperId, isActive: true });
    } else {
      paper = await ExamPaper.findOne({ slug: paperId.toLowerCase(), isActive: true });
    }

    if (!paper) {
      res.status(404).json(errorResponse('Paper not found or is inactive'));
      return;
    }

    const subjects = await Subject.find({ paperId: paper._id, isActive: true }).sort({ order: 1 });
    res.status(200).json(successResponse('Paper subjects fetched successfully', subjects));
  } catch (error) {
    next(error);
  }
};
