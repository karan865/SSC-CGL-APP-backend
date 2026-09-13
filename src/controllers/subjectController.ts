import { Request, Response, NextFunction } from 'express';
import { Subject } from '../models/Subject';
import { successResponse } from '../utils/apiResponse';

export const getSubjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await Subject.find({ isActive: true }).sort({ order: 1 });
    res.status(200).json(successResponse('Subjects fetched successfully', subjects));
  } catch (error) {
    next(error);
  }
};
