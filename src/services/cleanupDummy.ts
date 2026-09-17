import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Topic } from '../models/Topic';

const cleanup = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) process.exit(1);

  await mongoose.connect(uri);
  const res = await Topic.deleteMany({ name: /^Topic [12] for/ });
  console.log('Removed empty dummy topics count:', res.deletedCount);

  const topics = await Topic.find({});
  console.log('Active Curated Topics:');
  topics.forEach((t) => console.log(` - ${t.name} (${t.slug})`));

  process.exit(0);
};

cleanup();
