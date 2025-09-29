// api/index.js (Vercel serverless function)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');

const app = express();

// ----------------- CORS -----------------
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://volauth-8cd3a.web.app',
  'https://vol-server-mu.vercel.app',
  'https://vol-server-mu.vercel.app/' 
];

// Debug log (only in dev)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log("Request Origin:", req.headers.origin);
    console.log("Request Method:", req.method);
    console.log("Request Path:", req.path);
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
    client = new MongoClient(uri, { 
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    await client.connect();
    console.log("✅ Connected to MongoDB");

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
    console.error('❌ Database connection error:', error);
    return res.status(503).json({ error: 'Database connection failed', message: error.message });
  }
};

// ----------------- Routes -----------------

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Volunteer API running on Vercel', 
    timestamp: new Date().toISOString(),
    endpoints: {
      volunteers: '/volunteer',
      applications: '/applications',
      users: '/users'
    }
  });
});

// ==================== VOLUNTEER ROUTES ====================

// Get all volunteers
app.get('/volunteer', checkDbConnection, async (req, res) => {
  try {
    const volunteers = await volunteerCollection.find().toArray();
    res.json(volunteers);
  } catch (err) {
    console.error('Error fetching volunteers:', err);
    res.status(500).json({ error: 'Failed to fetch volunteers', message: err.message });
  }
});

// Create volunteer post
app.post('/volunteer', checkDbConnection, async (req, res) => {
  try {
    const volunteerData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await volunteerCollection.insertOne(volunteerData);
    res.status(201).json({ 
      success: true, 
      message: 'Volunteer post created successfully',
      insertedId: result.insertedId 
    });
  } catch (err) {
    console.error('Error creating volunteer:', err);
    res.status(500).json({ error: 'Failed to create volunteer post', message: err.message });
  }
});

// Get single volunteer by ID
app.get('/volunteer/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid volunteer ID format' });
  }

  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(id) });
    
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer post not found' });
    }
    
    res.json(volunteer);
  } catch (err) {
    console.error('Error fetching volunteer:', err);
    res.status(500).json({ error: 'Failed to fetch volunteer', message: err.message });
  }
});

// Get volunteers by user email
app.get('/volunteer/user/:email', checkDbConnection, async (req, res) => {
  try {
    const email = req.params.email;
    const volunteers = await volunteerCollection.find({ organizerEmail: email }).toArray();
    res.json(volunteers);
  } catch (err) {
    console.error('Error fetching user volunteers:', err);
    res.status(500).json({ error: 'Failed to fetch user volunteers', message: err.message });
  }
});

// Update volunteer post (only by creator)
app.put('/volunteer/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid volunteer ID format' });
  }

  const userEmail = req.headers['x-user-email'];
  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized - email missing in headers' });
  }

  try {
    const post = await volunteerCollection.findOne({ _id: new ObjectId(id) });

    if (!post) {
      return res.status(404).json({ error: 'Volunteer post not found' });
    }

    if (post.organizerEmail !== userEmail) {
      return res.status(403).json({ error: 'Forbidden - you can only edit your own posts' });
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
        updatedAt: new Date()
      }
    };

    await volunteerCollection.updateOne(
      { _id: new ObjectId(id) },
      updatedPost
    );

    res.json({ 
      success: true,
      message: 'Volunteer post updated successfully' 
    });
  } catch (err) {
    console.error('Error updating volunteer:', err);
    res.status(500).json({ error: 'Failed to update volunteer post', message: err.message });
  }
});

// Delete volunteer post (only by creator)
app.delete('/volunteer/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid volunteer ID format' });
  }

  const userEmail = req.headers['x-user-email'];
  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized - email missing in headers' });
  }

  try {
    const post = await volunteerCollection.findOne({ _id: new ObjectId(id) });

    if (!post) {
      return res.status(404).json({ error: 'Volunteer post not found' });
    }

    if (post.organizerEmail !== userEmail) {
      return res.status(403).json({ error: 'Forbidden - you can only delete your own posts' });
    }

    await volunteerCollection.deleteOne({ _id: new ObjectId(id) });
    
    res.json({ 
      success: true,
      message: 'Volunteer post deleted successfully' 
    });
  } catch (err) {
    console.error('Error deleting volunteer:', err);
    res.status(500).json({ error: 'Failed to delete volunteer post', message: err.message });
  }
});

// Decrease volunteersNeeded count
app.patch('/volunteer/:id/decrease', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid volunteer ID format' });
  }

  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(id) });
    
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer post not found' });
    }

    if (volunteer.volunteersNeeded <= 0) {
      return res.status(400).json({ error: 'No volunteer slots available' });
    }

    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $inc: { volunteersNeeded: -1 },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({ 
      success: true,
      message: 'Volunteer count decreased successfully',
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('Error decreasing volunteer count:', err);
    res.status(500).json({ error: 'Failed to decrease volunteer count', message: err.message });
  }
});

// Increase volunteersNeeded count
app.patch('/volunteer/:id/increase', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid volunteer ID format' });
  }

  try {
    const volunteer = await volunteerCollection.findOne({ _id: new ObjectId(id) });
    
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer post not found' });
    }

    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $inc: { volunteersNeeded: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({ 
      success: true,
      message: 'Volunteer count increased successfully',
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('Error increasing volunteer count:', err);
    res.status(500).json({ error: 'Failed to increase volunteer count', message: err.message });
  }
});

// ==================== APPLICATION ROUTES ====================

// Get all applications
app.get('/applications', checkDbConnection, async (req, res) => {
  try {
    const applications = await applicationsCollection.find().toArray();
    res.json(applications);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications', message: err.message });
  }
});

// Get applications by user email
app.get('/applications/user/:email', checkDbConnection, async (req, res) => {
  try {
    const email = req.params.email;
    const applications = await applicationsCollection.find({ userEmail: email }).toArray();
    console.log(`Found ${applications.length} applications for ${email}`);
    res.json(applications);
  } catch (err) {
    console.error('Error fetching user applications:', err);
    res.status(500).json({ error: 'Failed to fetch user applications', message: err.message });
  }
});

// Create application
app.post('/applications', checkDbConnection, async (req, res) => {
  try {
    const applicationData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await applicationsCollection.insertOne(applicationData);
    console.log('Application created:', result.insertedId);
    
    res.status(201).json({ 
      success: true,
      message: 'Application submitted successfully',
      insertedId: result.insertedId,
      application: {
        _id: result.insertedId,
        ...applicationData
      }
    });
  } catch (err) {
    console.error('Error creating application:', err);
    res.status(500).json({ error: 'Failed to create application', message: err.message });
  }
});

// Delete application
app.delete('/applications/:id', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  
  if (!ObjectId.isValid(id)) {
    console.error('Invalid application ID format:', id);
    return res.status(400).json({ error: 'Invalid application ID format' });
  }

  try {
    console.log('Attempting to delete application:', id);
    
    // First, check if the application exists
    const application = await applicationsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!application) {
      console.error('Application not found:', id);
      return res.status(404).json({ error: 'Application not found' });
    }

    console.log('Found application:', application);

    // Delete the application
    const result = await applicationsCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      console.error('Failed to delete application:', id);
      return res.status(404).json({ error: 'Failed to delete application' });
    }

    console.log('Application deleted successfully:', id);

    res.json({ 
      success: true,
      message: 'Application deleted successfully',
      deletedId: id,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Error deleting application:', err);
    res.status(500).json({ error: 'Failed to delete application', message: err.message });
  }
});

// Update application status (optional - for future use)
app.patch('/applications/:id/status', checkDbConnection, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid application ID format' });
  }

  if (!['requested', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const result = await applicationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: status,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ 
      success: true,
      message: 'Application status updated successfully',
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('Error updating application status:', err);
    res.status(500).json({ error: 'Failed to update application status', message: err.message });
  }
});

// ==================== USER ROUTES ====================

// Get all users
app.get('/users', checkDbConnection, async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users', message: err.message });
  }
});

// Create user
app.post('/users', checkDbConnection, async (req, res) => {
  try {
    const userData = {
      ...req.body,
      createdAt: new Date()
    };
    
    const result = await usersCollection.insertOne(userData);
    
    res.status(201).json({ 
      success: true,
      message: 'User created successfully',
      insertedId: result.insertedId 
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user', message: err.message });
  }
});

// Get user by email
app.get('/users/:email', checkDbConnection, async (req, res) => {
  try {
    const email = req.params.email;
    const user = await usersCollection.findOne({ email: email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user', message: err.message });
  }
});

// ----------------- Error Handler -----------------
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Export the Express API for Vercel
module.exports = app;