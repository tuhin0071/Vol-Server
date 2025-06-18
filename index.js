const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();

// ✅ Allowed origins - no trailing slashes
const allowedOrigins = [
  'https://dulcet-wisp-054d6c.netlify.app',
 
];

// ✅ CORS Setup
app.use(
  cors({
    origin: (origin, callback) => {
      console.log('🔗 Request Origin:', origin);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('❌ CORS Blocked Origin:', origin);
        callback(new Error('CORS policy: This origin is not allowed.'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// ✅ MongoDB URI from .env
const uri = process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

if (!uri) {
  console.error('❌ MongoDB URI is not defined. Set MONGODB_URI or DB_USER/DB_PASS.');
}

const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

let volunteerCollection;
let applicationsCollection;
let isDbConnected = false;

async function startServer() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    const db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
    isDbConnected = true;
    console.log('✅ MongoDB Connected');

    // Local only
    if (process.env.NODE_ENV !== 'serverless') {
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`🚀 Server is running at http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    isDbConnected = false;
  }
}

startServer();

// ✅ Middleware to check DB connection
const checkDbConnection = (req, res, next) => {
  if (!isDbConnected) {
    return res.status(503).json({
      error: 'Database not connected',
      message: 'Check MongoDB connection',
    });
  }
  next();
};

// ✅ Routes

app.get('/', (req, res) => {
  res.json({
    message: 'Volunteer API is running',
    dbConnected: isDbConnected,
  });
});

app.get('/volunteer', checkDbConnection, async (req, res) => {
  try {
    const volunteers = await volunteerCollection.find().toArray();
    res.json(volunteers);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching volunteers', details: err.message });
  }
});

app.get('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
    res.json(volunteer);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching volunteer', details: err.message });
  }
});

app.post('/volunteer', checkDbConnection, async (req, res) => {
  try {
    const result = await volunteerCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error creating volunteer', details: err.message });
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
    res.status(500).json({ error: 'Error updating volunteersNeeded', details: err.message });
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
    res.status(500).json({ error: 'Error deleting volunteer', details: err.message });
  }
});

app.post('/applications', checkDbConnection, async (req, res) => {
  try {
    const result = await applicationsCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error creating application', details: err.message });
  }
});

app.get('/applications', checkDbConnection, async (req, res) => {
  try {
    const applications = await applicationsCollection.find().toArray();
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching applications', details: err.message });
  }
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ✅ Export for Vercel (serverless)
module.exports = app;
module.exports.handler = require('serverless-http')(app);
