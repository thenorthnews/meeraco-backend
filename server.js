import app from './src/app.js';
import connectDB from './src/config/db.js';
import mongoose from 'mongoose';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start HTTP Server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Meeraco CRM Backend running on http://localhost:${PORT}`);
      console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/v1`);
      console.log(`🩺 Health check at http://localhost:${PORT}/api/v1/health`);
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('\nStopping server gracefully...');
      server.close(async () => {
        await mongoose.disconnect();
        console.log('MongoDB disconnected. Exiting.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}

startServer();
