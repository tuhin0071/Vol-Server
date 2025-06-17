

const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;


const allowedOrigins = [
  'http://localhost:5173',
  'https://ephemeral-toffee-b3e7ef.netlify.app'
];

app.use(cors({
  origin: function(origin, callback){
    // Allow requests with no origin like mobile apps or curl
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,  // Allow cookies to be sent
}));

app.options('*', cors()); // Enable pre-flight across-the-board

app.use(express.json());
app.use(cookieParser());

// === MongoDB Setup ===
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// === JWT Token Verification Middleware ===
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
    req.user = decoded;
    next();
  });
};

// === Connect to DB and define routes ===
async function run() {
  try {
    await client.connect();

    const db = client.db('Volunteer-service');
    const volunteerCollection = db.collection('volunteer');
    const applicationsCollection = db.collection('applications');

    // POST /jwt — issue token & set cookie
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

    // Example protected route
    app.get('/protected', verifyToken, (req, res) => {
      res.json({ message: 'Access granted!', user: req.user });
    });

    // GET all volunteers
    app.get('/volunteer', async (req, res) => {
      try {
        const volunteers = await volunteerCollection.find().toArray();
        res.json(volunteers);
      } catch {
        res.status(500).json({ error: 'Failed to fetch volunteers' });
      }
    });

    // GET volunteer by id
    app.get('/volunteer/:id', async (req, res) => {
      try {
        const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
        res.json(volunteer);
      } catch {
        res.status(500).json({ error: 'Error fetching volunteer' });
      }
    });

    // POST new volunteer
    app.post('/volunteer', async (req, res) => {
      try {
        const result = await volunteerCollection.insertOne(req.body);
        res.status(201).json(result);
      } catch {
        res.status(500).json({ error: 'Error creating volunteer post' });
      }
    });

    // PATCH decrease volunteersNeeded
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

    // DELETE volunteer by id
    app.delete('/volunteer/:id', async (req, res) => {
      try {
        const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Post not found' });
        res.json({ message: 'Volunteer post deleted' });
      } catch {
        res.status(500).json({ error: 'Error deleting post' });
      }
    });

    // POST application
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
        const userEmail = req.user.email;
        const result = await applicationsCollection.find({ userEmail }).toArray();
        res.json(result);
      } catch {
        res.status(500).json({ error: 'Error fetching applications' });
      }
    });

    // Ping test
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('🌍 Volunteer Platform API is running');
});


if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}

module.exports = app;
