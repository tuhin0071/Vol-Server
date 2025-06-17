require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:5173',
  'https://ephemeral-toffee-b3e7ef.netlify.app'
];

// CORS config
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('Not allowed by CORS'), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.options('*', cors());
app.use(express.json());
app.use(cookieParser());

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const db = client.db('Volunteer-service');
    const volunteerCollection = db.collection('volunteer');
    const applicationsCollection = db.collection('applications');

    // Health check
    app.get('/', (req, res) => res.send('Volunteer API is running'));

    // JWT issue token
    app.post('/jwt', (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email required' });
      const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
      }).json({ success: true, token });
    });

    // Get all volunteers
    app.get('/volunteer', async (req, res) => {
      try {
        const volunteers = await volunteerCollection.find().toArray();
        res.json(volunteers);
      } catch (e) {
        res.status(500).json({ error: 'Failed to fetch volunteers' });
      }
    });

    // Get volunteer by id
    app.get('/volunteer/:id', async (req, res) => {
      try {
        const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
        res.json(volunteer);
      } catch {
        res.status(500).json({ error: 'Error fetching volunteer' });
      }
    });

    // Create new volunteer post
    app.post('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: 'Error creating volunteer post' });
      }
    });

    // Decrease volunteersNeeded count
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

    // Delete volunteer post
    app.delete('/volunteer/:id', async (req, res) => {
      try {
        const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Volunteer post deleted' });
      } catch {
        res.status(500).json({ error: 'Error deleting post' });
      }
    });

    // Post an application
    app.post('/applications', async (req, res) => {
      try {
        const result = await applicationsCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: 'Error submitting application' });
      }
    });

    // Get user applications (protected route)
    app.get('/applications', verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const apps = await applicationsCollection.find({ userEmail }).toArray();
        res.json(apps);
      } catch {
        res.status(500).json({ error: 'Error fetching applications' });
      }
    });

    // Catch-all 404
    app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    app.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

run();
