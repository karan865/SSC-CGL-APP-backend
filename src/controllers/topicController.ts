import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { Question } from '../models/Question';
import { successResponse, errorResponse } from '../utils/apiResponse';

export const getTopicsBySubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;
    const { examId, stageId, paperId } = req.query;

    let subject;
    if (mongoose.Types.ObjectId.isValid(subjectId)) {
      subject = await Subject.findOne({ _id: subjectId, isActive: true });
    } else {
      subject = await Subject.findOne({ slug: subjectId.toLowerCase(), isActive: true });
    }

    if (!subject) {
      res.status(404).json(errorResponse('Subject not found or is inactive'));
      return;
    }

    const query: any = { subjectId: subject._id, isActive: true };
    if (examId && typeof examId === 'string' && mongoose.Types.ObjectId.isValid(examId)) {
      query.examId = examId;
    }
    if (stageId && typeof stageId === 'string' && mongoose.Types.ObjectId.isValid(stageId)) {
      query.stageId = stageId;
    }
    if (paperId && typeof paperId === 'string' && mongoose.Types.ObjectId.isValid(paperId)) {
      query.paperId = paperId;
    }

    const topics = await Topic.find(query).sort({ order: 1 }).lean();

    // Aggregate total questions per topic
    const topicIds = topics.map(t => t._id);
    const questionCounts = await Question.aggregate([
      {
        $match: {
          topicId: { $in: topicIds },
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$topicId',
          totalQuestions: { $sum: 1 },
        },
      },
    ]);

    const countsMap = new Map(questionCounts.map(q => [q._id.toString(), q.totalQuestions]));

    const topicsWithCounts = topics.map(t => ({
      ...t,
      totalQuestions: countsMap.get(t._id.toString()) || 0,
    }));

    res.status(200).json(successResponse('Topics fetched successfully', topicsWithCounts));
  } catch (error) {
    next(error);
  }
};
