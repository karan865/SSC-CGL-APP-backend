import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ExamPaper as Paper } from '../models/ExamPaper';
import { Subject } from '../models/Subject';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  console.log('Cleaning up exact duplicates in GS1...');
  const gs1 = await Paper.findOne({ name: 'General Studies I', isActive: true });
  if (!gs1) return process.exit(1);

  const duplicateSlugs = [
    'prelims-history',
    'prelims-geography',
    'prelims-polity',
    'prelims-economy',
    'prelims-science',
    'prelims-jharkhand',
    'prelims-current-events',
    'prelims-misc'
  ];

  const result = await Subject.updateMany(
    { paperId: gs1._id, slug: { $in: duplicateSlugs } },
    { $set: { isActive: false } }
  );

  console.log(`Deactivated ${result.modifiedCount} duplicate subjects!`);
  process.exit(0);
});
