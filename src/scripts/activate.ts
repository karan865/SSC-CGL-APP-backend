import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  await mongoose.connection.db.collection('subjects').updateOne({ slug: 'jpsc-history' }, { $set: { isActive: true } });
  console.log('Subject set to active!');
  process.exit(0);
});
