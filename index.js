// api/index.js or server.js (for local/dev)
// ✅ Express Server for Volunteer Platform

const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// Init app
const app = express();
const port = process.env.PORT || 3000;

// 🔐 Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://silver-cannoli-ca18a6.netlify.app'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// 🔗 MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// 🔐 JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
    req.user = decoded;
    next();
  });
};

// 🚀 Start Server
async function run() {
  try {
    await client.connect();

    const db = client.db('Volunteer-service');
    const volunteerCollection = db.collection('volunteer');
    const applicationsCollection = db.collection('applications');

    // 🪪 Issue JWT Token
    app.post('/jwt', async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required' });

      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      }).json({ success: true });
    });

    // 🔒 Protected Test Route
    app.get('/protected', verifyToken, (req, res) => {
      res.json({ message: 'Access granted!', user: req.user });
    });

    // 📄 Volunteer Routes
    app.get('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.find().toArray();
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Failed to fetch volunteers' });
      }
    });

    app.get('/volunteer/:id', async (req, res) => {
      try {
        const result = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
        result ? res.json(result) : res.status(404).json({ error: 'Volunteer not found' });
      } catch {
        res.status(500).json({ error: 'Error fetching volunteer' });
      }
    });

    app.post('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: 'Error creating volunteer post' });
      }
    });

    app.patch('/volunteer/:id/decrease', async (req, res) => {
      try {
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
        const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        result.deletedCount
          ? res.json({ message: 'Volunteer post deleted' })
          : res.status(404).json({ error: 'Post not found' });
      } catch {
        res.status(500).json({ error: 'Error deleting post' });
      }
    });

    // 📩 Application Routes
    app.post('/applications', async (req, res) => {
      try {
        const result = await applicationsCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: 'Error submitting application' });
      }
    });

    app.get('/applications', async (req, res) => {
      try {
        const result = await applicationsCollection.find().toArray();
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Error fetching applications' });
      }
    });

    // ✅ MongoDB Ping Test
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

run().catch(console.dir);

// 🌐 Base Route
app.get('/', (req, res) => {
  res.send('🌍 Volunteer Platform API is running');
});

// Start local server (not used in Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}

module.exports = app; 
