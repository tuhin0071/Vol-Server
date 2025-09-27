require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

// ----------------- Express App -----------------
const app = express();

// ----------------- CORS -----------------
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://volauth-8cd3a.web.app',
  'https://your-frontend.vercel.app' // Add Vercel frontend here
];

app.use((req, res, next) => {
  console.log("Request Origin:", req.headers.origin);
  next();
});

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
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let volunteerCollection;
let applicationsCollection;
let usersCollection;
let isDbConnected = false;

async function connectDb() {
  if (!isDbConnected) {
    console.log('🔄 Connecting to MongoDB...');
    await client.db('admin').command({ ping: 1 });

    const db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
    usersCollection = db.collection('users');

    isDbConnected = true;
    console.log('✅ MongoDB connected successfully');
  }
}
connectDb();

// ----------------- Middleware -----------------
const checkDbConnection = (req, res, next) => {
  if (!isDbConnected) return res.status(503).json({ error: 'Database not connected' });
  next();
};

// ----------------- Routes -----------------
app.get('/', (req, res) => {
  res.json({ message: 'Volunteer API running on Vercel', dbConnected: isDbConnected });
});

// Volunteer Posts
app.get('/volunteer', checkDbConnection, async (req, res) => {
  const volunteers = await volunteerCollection.find().toArray();
  res.json(volunteers);
});

app.post('/volunteer', checkDbConnection, async (req, res) => {
  const result = await volunteerCollection.insertOne(req.body);
  res.status(201).json(result);
});

app.get('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
  res.json(volunteer);
});

app.delete('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) return res.status(401).json({ error: 'Unauthorized - email missing' });

  const post = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!post) return res.status(404).json({ error: 'Volunteer post not found' });
  if (post.organizerEmail !== userEmail) return res.status(403).json({ error: 'Forbidden - you cannot delete this post' });

  await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ message: 'Volunteer post deleted successfully' });
});

app.put('/volunteer/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  const userEmail = req.headers['x-user-email'];
  if (!userEmail) return res.status(401).json({ error: 'Unauthorized - email missing' });

  const post = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!post) return res.status(404).json({ error: 'Volunteer post not found' });
  if (post.organizerEmail !== userEmail) return res.status(403).json({ error: 'Forbidden - you cannot edit this post' });

  const updatedPost = {
    $set: {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      location: req.body.location,
      volunteers: req.body.volunteers,
      deadline: req.body.deadline,
      thumbnail: req.body.thumbnail,
    }
  };
  await volunteerCollection.updateOne({ _id: new ObjectId(req.params.id) }, updatedPost);
  res.json({ message: 'Volunteer post updated successfully' });
});

// Applications
app.get('/applications', checkDbConnection, async (req, res) => {
  const applications = await applicationsCollection.find().toArray();
  res.json(applications);
});

app.post('/applications', checkDbConnection, async (req, res) => {
  const result = await applicationsCollection.insertOne(req.body);
  res.status(201).json(result);
});

app.delete('/applications/:id', checkDbConnection, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
  const result = await applicationsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Application not found' });
  res.json({ message: 'Application deleted successfully' });
});

// Users
app.get('/users', checkDbConnection, async (req, res) => {
  const users = await usersCollection.find().toArray();
  res.json(users);
});

app.post('/users', checkDbConnection, async (req, res) => {
  const result = await usersCollection.insertOne(req.body);
  res.status(201).json(result);
});

// ----------------- Export for Vercel -----------------
module.exports = app;
