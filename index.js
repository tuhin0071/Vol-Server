const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db('Volunteer-service');
    const volunteerCollection = db.collection('volunteer');
    const applicationsCollection = db.collection('applications');

    // Get all volunteers
    app.get('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch volunteers' });
      }
    });

    // Get single volunteer by ID
    app.get('/volunteer/:id', async (req, res) => {
      const id = req.params.id;
      try {
        const result = await volunteerCollection.findOne({ _id: new ObjectId(id) });
        if (!result) {
          return res.status(404).json({ error: 'Volunteer post not found' });
        }
        res.json(result);
      } catch (err) {
        console.error('Error finding volunteer by ID:', err);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Post new volunteer
    app.post('/volunteer', async (req, res) => {
      const post = req.body;
      try {
        const result = await volunteerCollection.insertOne(post);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).json({ error: 'Server error while posting volunteer' });
      }
    });

    // 🔥 PATCH to decrease volunteer count
    app.patch('/volunteer/:id/decrease', async (req, res) => {
      const id = req.params.id;
      try {
        const result = await volunteerCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { volunteersNeeded: -1 } }
        );
        res.send(result);
      } catch (err) {
        console.error('Error decreasing volunteer count:', err);
        res.status(500).json({ error: 'Failed to decrease volunteer count' });
      }
    });

    // 💾 Post new application
    app.post('/applications', async (req, res) => {
      const application = req.body;
      try {
        const result = await applicationsCollection.insertOne(application);
        res.status(201).send(result);
      } catch (err) {
        console.error('Error inserting application:', err);
        res.status(500).json({ error: 'Failed to submit application' });
      }
    });

    // 📥 Get all applications
    app.get('/applications', async (req, res) => {
      try {
        const applications = await applicationsCollection.find().toArray();
        res.send(applications);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch applications' });
      }
    });

    // Confirm MongoDB connection
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB");

  } finally {
    // Don't close the client so server stays running
  }
}

run().catch(console.dir);

// Basic test route
app.get('/', (req, res) => {
  res.send('🚀 Volunteer Platform API Running!');
});

app.listen(port, () => {
  console.log(`🌐 Server is listening on port ${port}`);
});
