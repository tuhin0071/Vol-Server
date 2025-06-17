const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();

// CORS Setup - Updated with better configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://dynamic-cocada-616ba8.netlify.app',
  'http://localhost:3000',
  'https://transcendent-capybara-c96c4a.netlify.app' // Add other potential origins
];

// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(cookieParser());

// MongoDB Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let volunteerCollection, applicationsCollection;

client.connect()
  .then(() => {
    const db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
    console.log('✅ MongoDB Connected');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err);
  });

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
    req.user = decoded;
    next();
  });
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: '🌍 Volunteer API is running on Vercel', status: 'OK' });
});

// JWT Issue Route - Fixed
app.post('/jwt', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Set cookie with proper configuration for cross-origin
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only secure in production
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
  });

  res.json({ success: true, message: 'Token issued successfully' });
});

// Volunteer Routes
app.get('/volunteer', async (req, res) => {
  try {
    if (!volunteerCollection) {
      return res.status(500).json({ error: 'Database not ready' });
    }

    const result = await volunteerCollection.find().toArray();
    res.json(result);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ error: 'Error fetching volunteers' });
  }
});

app.get('/volunteer/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const result = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    result ? res.json(result) : res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    res.status(500).json({ error: 'Error fetching volunteer' });
  }
});

app.post('/volunteer', async (req, res) => {
  try {
    const result = await volunteerCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Error creating post' });
  }
});

app.patch('/volunteer/:id/decrease', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { volunteersNeeded: -1 } }
    );
    res.json(result);
  } catch (error) {
    console.error('Error updating count:', error);
    res.status(500).json({ error: 'Error updating count' });
  }
});

app.delete('/volunteer/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    result.deletedCount
      ? res.json({ message: 'Post deleted' })
      : res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Error deleting post' });
  }
});

// Applications
app.post('/applications', async (req, res) => {
  try {
    const result = await applicationsCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ error: 'Error submitting application' });
  }
});

app.get('/applications', verifyToken, async (req, res) => {
  try {
    const result = await applicationsCollection.find({ userEmail: req.user.email }).toArray();
    res.json(result);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Error fetching applications' });
  }
});

// Export for Vercel
module.exports = app;
module.exports.handler = serverless(app);