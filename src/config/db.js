import mongoose from 'mongoose';

/**
 * 🍃 Simple & Clean MongoDB Connection using Mongoose
 */
export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    const dbName = process.env.DB_NAME || 'meeraco_crm';

    const conn = await mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 5000
    });

    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
