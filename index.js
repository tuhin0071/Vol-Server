const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();

// CORS setup - Updated to include port 5174
const allowedOrigins = [
  'https://transcendent-capybara-c96c4a.netlify.app',
  'https://dynamic-cocada-616ba8.netlify.app',
  'http://localhost:5173', // React dev server origin
  'http://localhost:5174', // Additional React dev server port
  'http://localhost:3000'  // Backend local server origin (if needed)
];

app.use(cors({
  origin: (origin, callback) => {
    console.log('🔍 Request from origin:', origin); // Debug log
    // Allow requests with no origin like curl or Postman
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('CORS policy: Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json()); // For parsing JSON bodies

// MongoDB client setup with better error handling
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Check if environment variables are loaded
if (!process.env.DB_USER || !process.env.DB_PASS) {
  console.error('❌ Missing database credentials in environment variables');
  console.log('🔍 DB_USER:', process.env.DB_USER ? 'Set' : 'Missing');
  console.log('🔍 DB_PASS:', process.env.DB_PASS ? 'Set' : 'Missing');
}

const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let volunteerCollection;
let applicationsCollection;
let isDbConnected = false;

async function startServer() {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    await client.connect();
    
    // Test the connection
    await client.db("admin").command({ ping: 1 });
    
    const db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
    isDbConnected = true;
    
    console.log('✅ MongoDB Connected successfully');

    // Only start listening if running as a standalone server
    if (process.env.NODE_ENV !== 'serverless') {
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log('🔗 Allowed CORS origins:', allowedOrigins);
      });
    }
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('🔍 Full error:', err);
    // Don't exit process, keep server running for debugging
    isDbConnected = false;
  }
}

startServer();

// Middleware to check database connection
const checkDbConnection = (req, res, next) => {
  if (!isDbConnected) {
    return res.status(503).json({ 
      error: 'Database not connected',
      message: 'Please check your MongoDB connection and credentials'
    });
  }
  next();
};

// Routes with better error handling

app.get('/', (req, res) => {
  res.json({ 
    message: 'Volunteer API is running', 
    status: 'OK',
    dbConnected: isDbConnected,
    allowedOrigins: allowedOrigins
  });
});

app.get('/volunteer', checkDbConnection, async (req, res) => {
  try {
    console.log('📥 GET /volunteer request received');
    const volunteers = await volunteerCollection.find().toArray();
    console.log('✅ Found', volunteers.length, 'volunteers');
    res.json(volunteers);
  } catch (err) {
    console.error('❌ Error fetching volunteers:', err.message);
    console.error('🔍 Full error:', err);
    res.status(500).json({ 
      error: 'Error fetching volunteers',
      details: err.message
    });
  }
});

app.get('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    res.json(volunteer);
  } catch (err) {
    console.error('❌ Error fetching volunteer:', err.message);
    res.status(500).json({ 
      error: 'Error fetching volunteer',
      details: err.message
    });
  }
});

app.post('/volunteer', checkDbConnection, async (req, res) => {
  try {
    console.log('📥 POST /volunteer request received:', req.body);
    const result = await volunteerCollection.insertOne(req.body);
    console.log('✅ Volunteer created with ID:', result.insertedId);
    res.status(201).json(result);
  } catch (err) {
    console.error('❌ Error creating volunteer:', err.message);
    res.status(500).json({ 
      error: 'Error creating volunteer',
      details: err.message
    });
  }
});

app.patch('/volunteer/:id/decrease', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  try {
    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { volunteersNeeded: -1 } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    
    res.json(result);
  } catch (err) {
    console.error('❌ Error updating volunteersNeeded:', err.message);
    res.status(500).json({ 
      error: 'Error updating volunteersNeeded',
      details: err.message
    });
  }
});

app.delete('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  try {
    const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    res.json({ message: 'Volunteer post deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting volunteer:', err.message);
    res.status(500).json({ 
      error: 'Error deleting volunteer',
      details: err.message
    });
  }
});

app.post('/applications', checkDbConnection, async (req, res) => {
  try {
    console.log('📥 POST /applications request received:', req.body);
    const result = await applicationsCollection.insertOne(req.body);
    console.log('✅ Application created with ID:', result.insertedId);
    res.status(201).json(result);
  } catch (err) {
    console.error('❌ Error creating application:', err.message);
    res.status(500).json({ 
      error: 'Error creating application',
      details: err.message
    });
  }
});

app.get('/applications', checkDbConnection, async (req, res) => {
  try {
    console.log('📥 GET /applications request received');
    const applications = await applicationsCollection.find().toArray();
    console.log('✅ Found', applications.length, 'applications');
    res.json(applications);
  } catch (err) {
    console.error('❌ Error fetching applications:', err.message);
    res.status(500).json({ 
      error: 'Error fetching applications',
      details: err.message
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// Export for serverless deployment (e.g., Vercel)
module.exports = app;
module.exports.handler = require('serverless-http')(app);