const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI; // Make sure this is defined in .env

(async () => {
  try {
    console.log('Attempting MongoDB connection...');
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connection successful!');
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
})();
