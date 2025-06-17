require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// MongoDB connection URI constructed with environment variables for security
const uri = `mongodb+srv://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASS)}@cluster0.a3vfxtj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

let volunteerCollection;
let applicationsCollection;

// Connect to MongoDB once on server start
async function connectDB() {
  try {
    await client.connect();
    console.log('✅ MongoDB connected');

    const db = client.db('Volunteer-service');
    volunteerCollection = db.collection('volunteer');
    applicationsCollection = db.collection('applications');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Middleware to verify JWT token from cookies
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
    req.user = decoded;
    next();
  });
}

// Routes
app.get('/', (req, res) => {
  res.send('🌍 Volunteer Platform API is running');
});

app.post('/jwt', (req, res) => {
  const { email } = req.body;
  console.log('JWT request email:', email);

  if (!email) return res.status(400).json({ message: 'Email required' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  }).json({ token });
});


app.get('/protected', verifyToken, (req, res) => {
  res.json({ message: 'Access granted', user: req.user });
});

// Volunteer routes
app.get('/volunteer', async (req, res) => {
  try {
    const volunteers = await volunteerCollection.find().toArray();
    res.json(volunteers);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch volunteers' });
  }
});

app.get('/volunteer/:id', async (req, res) => {
  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
    res.json(volunteer);
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    res.status(500).json({ error: 'Failed to fetch volunteer' });
  }
});

app.post('/volunteer', async (req, res) => {
  try {
    const result = await volunteerCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating volunteer post:', error);
    res.status(500).json({ error: 'Failed to create volunteer post' });
  }
});

app.patch('/volunteer/:id/decrease', async (req, res) => {
  try {
    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { volunteersNeeded: -1 } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Volunteer post not found' });
    res.json({ message: 'Volunteers needed decreased', modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error updating volunteer count:', error);
    res.status(500).json({ error: 'Failed to update volunteer count' });
  }
});

app.delete('/volunteer/:id', async (req, res) => {
  try {
    const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Volunteer post not found' });
    res.json({ message: 'Volunteer post deleted' });
  } catch (error) {
    console.error('Error deleting volunteer post:', error);
    res.status(500).json({ error: 'Failed to delete volunteer post' });
  }
});

// Applications routes
app.post('/applications', async (req, res) => {
  try {
    const result = await applicationsCollection.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

app.get('/applications', verifyToken, async (req, res) => {
  try {
    const applications = await applicationsCollection.find({ userEmail: req.user.email }).toArray();
    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Start server after DB connection
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
