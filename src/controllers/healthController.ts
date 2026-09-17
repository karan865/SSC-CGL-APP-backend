import { Request, Response } from 'express';
import { successResponse } from '../utils/apiResponse';

export const getHealth = (req: Request, res: Response) => {
  res.status(200).json(successResponse('SSC CGL API is running'));
};
