const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

// App init
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://ephemeral-toffee-b3e7ef.netlify.app'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1, 
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db('Volunteer-service');
    const volunteerCollection = db.collection('volunteer');
    const applicationsCollection = db.collection('applications');

    // JWT verification middleware
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
      res.send('🌍 Volunteer Platform API is running locally');
    });

    app.post('/jwt', (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email required' });

      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: false, 
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      }).json({ success: true });
    });

    app.get('/protected', verifyToken, (req, res) => {
      res.json({ message: 'Access granted', user: req.user });
    });

    // Volunteer CRUD
    app.get('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.find().toArray();
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Error fetching volunteers' });
      }
    });

    app.get('/volunteer/:id', async (req, res) => {
      try {
        const result = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
        result ? res.json(result) : res.status(404).json({ error: 'Not found' });
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
        res.status(500).json({ error: 'Error updating count' });
      }
    });

    app.delete('/volunteer/:id', async (req, res) => {
      try {
        const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        result.deletedCount
          ? res.json({ message: 'Post deleted' })
          : res.status(404).json({ error: 'Not found' });
      } catch {
        res.status(500).json({ error: 'Error deleting post' });
      }
    });

    // Applications
    app.post('/applications', async (req, res) => {
      try {
        const result = await applicationsCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: 'Error submitting application' });
      }
    });

    app.get('/applications', verifyToken, async (req, res) => {
      try {
        const result = await applicationsCollection.find({ userEmail: req.user.email }).toArray();
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Error fetching applications' });
      }
    });

  } catch (err) {
    console.error("❌ Server error:", err);
  }
}

run().catch(console.dir);

// Start server locally
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
