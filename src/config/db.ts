import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is not defined.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected Successfully : ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};
