
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await mongoose.connection.collection('dailystudyplans').dropIndex('userId_1_dateKey_1');
    console.log('Old index dropped successfully.');
  } catch (e) {
    console.log('Index might already be dropped or not exist:', e.message);
  }
  process.exit(0);
}
run();

