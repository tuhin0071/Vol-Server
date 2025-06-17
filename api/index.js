const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://ephemeral-toffee-b3e7ef.netlify.app'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB Setup
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: ServerApiVersion.v1,
});
let db, volunteerCollection, applicationsCollection;

async function connectToDB() {
  if (!db) {
    try {
      await client.connect();
      db = client.db('Volunteer-service');
      volunteerCollection = db.collection('volunteer');
      applicationsCollection = db.collection('applications');
      console.log('✅ MongoDB connected');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err);
    }
  }
}

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('❌ Token verification failed:', err);
      return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// Routes
app.get('/', (req, res) => {
  res.send('🌍 Vercel Volunteer API is running');
});

app.post('/jwt', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    }).json({ success: true });
  } catch (err) {
    console.error('❌ JWT issue error:', err);
    res.status(500).json({ error: 'Token creation failed' });
  }
});

app.get('/protected', verifyToken, (req, res) => {
  res.json({ message: 'Access granted!', user: req.user });
});

// Volunteer Routes
app.get('/volunteer', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.find().toArray();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch volunteers' });
  }
});

app.get('/volunteer/:id', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    result ? res.json(result) : res.status(404).json({ error: 'Volunteer not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching volunteer' });
  }
});

app.post('/volunteer', async (req, res) => {
  try {
    await connectToDB();
    const result = await volunteerCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
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
  } catch (err) {
    console.error(err);
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting post' });
  }
});

// Applications
app.post('/applications', async (req, res) => {
  try {
    await connectToDB();
    const result = await applicationsCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error submitting application' });
  }
});

app.get('/applications', verifyToken, async (req, res) => {
  try {
    await connectToDB();
    const userEmail = req.user.email;
    const result = await applicationsCollection.find({ userEmail }).toArray();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching applications' });
  }
});

// Export ONLY handler for Vercel
module.exports.handler = serverless(app);
