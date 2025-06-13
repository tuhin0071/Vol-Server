const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

    const volunteerCollection = client.db('Volunteer-service').collection('volunteer');

    // Get all volunteer posts
    app.get('/volunteer', async (req, res) => {
      const cursor = volunteerCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get one volunteer post by ID
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

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Don't close client so server keeps running
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
