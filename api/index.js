// api/index.js

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'https://ephemeral-toffee-b3e7ef.netlify.app'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB setup
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: ServerApiVersion.v1,
});
let db, volunteerCollection, applicationsCollection;

async function connectToDB() {
  if (!db) {
    await client.connect();
    db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
  }
}

// Middleware to verify token
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
  res.send('🌍 Vercel Volunteer API is running');
});

app.post('/jwt', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  }).json({ success: true });
});

app.get('/protected', verifyToken, (req, res) => {
  res.json({ message: 'Access granted!', user: req.user });
});

app.get('/volunteer', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.find().toArray();
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch volunteers' });
  }
});

app.get('/volunteer/:id', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    result ? res.json(result) : res.status(404).json({ error: 'Volunteer not found' });
  } catch {
    res.status(500).json({ error: 'Error fetching volunteer' });
  }
});

app.post('/volunteer', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch {
    res.status(500).json({ error: 'Error creating volunteer post' });
  }
});

app.patch('/volunteer/:id/decrease', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { volunteersNeeded: -1 } }
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error updating volunteer count' });
  }
});

app.delete('/volunteer/:id', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    result.deletedCount
      ? res.json({ message: 'Volunteer post deleted' })
      : res.status(404).json({ error: 'Post not found' });
  } catch {
    res.status(500).json({ error: 'Error deleting post' });
  }
});

app.post('/applications', async (req, res) => {
  try {
    await connectToDB();
    const result = await applicationsCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch {
    res.status(500).json({ error: 'Error submitting application' });
  }
});

app.get('/applications', verifyToken, async (req, res) => {
  try {
    await connectToDB();
    const userEmail = req.user.email;
    const result = await applicationsCollection.find({ userEmail }).toArray();
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error fetching applications' });
  }
});

// Export for Vercel
module.exports = app;
module.exports.handler = serverless(app);
