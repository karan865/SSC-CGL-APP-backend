import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Subject } from '../models/Subject';
import { Topic } from '../models/Topic';
import { successResponse, errorResponse } from '../utils/apiResponse';

export const getTopicsBySubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subjectId = req.params.subjectId as string;

    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      res.status(400).json(errorResponse('Invalid subject ID format'));
      return;
    }

    const subject = await Subject.findOne({ _id: subjectId, isActive: true });
    if (!subject) {
      res.status(404).json(errorResponse('Subject not found or is inactive'));
      return;
    }

    const topics = await Topic.find({ subjectId, isActive: true }).sort({ order: 1 });
    res.status(200).json(successResponse('Topics fetched successfully', topics));
  } catch (error) {
    next(error);
  }
};
