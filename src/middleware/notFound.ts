import { Request, Response } from 'express';
import { errorResponse } from '../utils/apiResponse';

export const notFound = (req: Request, res: Response) => {
  res.status(404).json(errorResponse(`API endpoint not found: ${req.originalUrl}`));
};
