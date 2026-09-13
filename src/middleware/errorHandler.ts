import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/apiResponse';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : err.message || 'Something went wrong';

  res.status(statusCode).json(errorResponse(message, [err.message]));
};
