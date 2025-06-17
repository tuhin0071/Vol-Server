require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Allowed frontend origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://ephemeral-toffee-b3e7ef.netlify.app'
];

app.use(cors({
  origin: function(origin, callback){
    if (!origin) return callback(null, true); // Allow non-browser requests
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy: This origin is not allowed'), false);
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
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
  strict: true,
  deprecationErrors: true,
});

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('Volunteer-service');
    const volunteerCollection = db.collection('volunteer');
    const applicationsCollection = db.collection('applications');

    // JWT middleware
    function verifyToken(req, res, next) {
      const token = req.cookies.token;
      if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
        req.user = decoded;
        next();
      });
    }

    // POST /jwt - create token and set cookie
    app.post('/jwt', (req, res) => {
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

    // Protected route example
    app.get('/protected', verifyToken, (req, res) => {
      res.json({ message: 'Access granted!', user: req.user });
    });

    // Get all volunteers
    app.get('/volunteer', async (req, res) => {
      try {
        const volunteers = await volunteerCollection.find().toArray();
        res.json(volunteers);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch volunteers' });
      }
    });

    // Get volunteer by id
    app.get('/volunteer/:id', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });

        const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(id) });
        if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
        res.json(volunteer);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching volunteer' });
      }
    });

    // Create new volunteer post
    app.post('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creating volunteer post' });
      }
    });

    // Decrease volunteersNeeded by 1
    app.patch('/volunteer/:id/decrease', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });

        const result = await volunteerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { volunteersNeeded: -1 } }
        );
        if (result.modifiedCount === 0) {
          return res.status(404).json({ error: 'Volunteer not found or no update made' });
        }
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating volunteer count' });
      }
    });

    // Delete volunteer post by id
    app.delete('/volunteer/:id', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID format' });

        const result = await volunteerCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Volunteer post deleted' });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting post' });
      }
    });

    // Create application
    app.post('/applications', async (req, res) => {
      try {
        const result = await applicationsCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error submitting application' });
      }
    });

    // Get applications for logged-in user
    app.get('/applications', verifyToken, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const result = await applicationsCollection.find({ userEmail }).toArray();
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching applications' });
      }
    });

    // Basic root route to test server
    app.get('/', (req, res) => {
      res.send('🌍 Volunteer Platform API is running');
    });

    // Ping MongoDB
    await client.db('admin').command({ ping: 1 });

  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

run().catch(console.dir);

// Only listen when NOT in production, for serverless platforms like Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}

module.exports = app;
