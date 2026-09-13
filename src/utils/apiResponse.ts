export const successResponse = (message: string, data: any = {}) => {
  return {
    success: true,
    message,
    data
  };
};

export const errorResponse = (message: string, errors: any[] = []) => {
  return {
    success: false,
    message,
    errors
  };
};
