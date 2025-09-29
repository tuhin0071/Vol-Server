// api/index.js (Vercel serverless function)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();

// ----------------- CORS -----------------
const allowedOrigins = [
  'http://localhost:5173',   // Vite dev
  'http://127.0.0.1:5173',
  'http://localhost:3000',   // CRA dev
  'http://localhost:5000',   // server itself
  'https://volauth-8cd3a.web.app', // deployed frontend
  'https://vol-server-mu.vercel.app',
  'https://vol-server-mu.vercel.app/' 
];

// Debug log (only in dev)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log("Request Origin:", req.headers.origin);
    next();
  });
}

// Middleware
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.error("❌ Blocked by CORS:", origin);
    callback(new Error("CORS policy: This origin is not allowed."));
  },
  credentials: true,
}));

// ----------------- MongoDB Setup -----------------
const uri = process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority`;

let client;
let volunteerCollection;
let applicationsCollection;
let usersCollection;

async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });
    await client.connect();

    const db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
    usersCollection = db.collection('users');
  }
  return client;
}

// Middleware to check DB connection
const checkDbConnection = async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(503).json({ error: 'Database connection failed' });
  }
};

// ----------------- Routes -----------------
app.get('/', (req, res) => {
  res.json({ message: 'Volunteer API running on Vercel', timestamp: new Date().toISOString() });
});

// ✅ Get all volunteers
app.get('/volunteer', checkDbConnection, async (req, res) => {
  try {
    const volunteers = await volunteerCollection.find().toArray();
    res.json(volunteers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create volunteer post
app.post('/volunteer', checkDbConnection, async (req, res) => {
  try {
    const result = await volunteerCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get single volunteer
app.get('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
    res.json(volunteer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete volunteer post (only by creator)
app.delete('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  const userEmail = req.headers['x-user-email'];
  if (!userEmail) return res.status(401).json({ error: 'Unauthorized - email missing' });

  try {
    const post = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!post) return res.status(404).json({ error: 'Volunteer post not found' });

    if (post.organizerEmail !== userEmail) {
      return res.status(403).json({ error: 'Forbidden - you cannot delete this post' });
    }

    await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'Volunteer post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Applications
app.get('/applications', checkDbConnection, async (req, res) => {
  try {
    const applications = await applicationsCollection.find().toArray();
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get posts by user email
app.get('/volunteer/user/:email', checkDbConnection, async (req, res) => {
  try {
    const email = req.params.email;
    const volunteers = await volunteerCollection.find({ organizerEmail: email }).toArray();
    res.json(volunteers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update volunteer post (only by creator)
app.put('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const userEmail = req.headers['x-user-email'];
  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized - email missing' });
  }

  try {
    const post = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!post) {
      return res.status(404).json({ error: 'Volunteer post not found' });
    }

    if (post.organizerEmail !== userEmail) {
      return res.status(403).json({ error: 'Forbidden - you cannot edit this post' });
    }

    const updatedPost = {
      $set: {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        location: req.body.location,
        volunteersNeeded: req.body.volunteersNeeded,
        deadline: req.body.deadline,
        thumbnail: req.body.thumbnail,
      }
    };

    await volunteerCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      updatedPost
    );

    res.json({ message: 'Volunteer post updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Create application
app.post('/applications', checkDbConnection, async (req, res) => {
  try {
    const result = await applicationsCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete application
app.delete('/applications/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await applicationsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Application not found' });
    res.json({ message: 'Application deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Users
app.get('/users', checkDbConnection, async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/users', checkDbConnection, async (req, res) => {
  try {
    const result = await usersCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Decrease volunteersNeeded
app.patch('/volunteer/:id/decrease', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(id) });
    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });

    if (volunteer.volunteersNeeded <= 0) {
      return res.status(400).json({ error: 'No volunteers needed left' });
    }

    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { volunteersNeeded: -1 } }
    );

    res.json({ message: 'Volunteers count decreased', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Increase volunteersNeeded (optional, for cancel/delete)
app.patch('/volunteer/:id/increase', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });

  try {
    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { volunteersNeeded: 1 } }
    );

    res.json({ message: 'Volunteers count increased', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- Error Handler -----------------
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Export the Express API for Vercel
module.exports = app;
