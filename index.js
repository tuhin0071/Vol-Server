const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
require('dotenv').config();

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };

  const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  });
  await client.connect();
  const db = client.db('Volunteer-service');

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

module.exports = async (req, res) => {
  const { method, url } = req;
  const { db } = await connectToDatabase();

  // Parse cookies
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;

  // JWT helper
  const verifyToken = () => {
    if (!token) return null;
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return null;
    }
  };

  // Routing
  try {
    if (method === 'GET' && url === '/') {
      return res.status(200).send('🌍 Volunteer Platform API is running');
    }

    if (method === 'GET' && url === '/volunteer') {
      const data = await db.collection('volunteer').find().toArray();
      return res.status(200).json(data);
    }

    if (method === 'POST' && url === '/volunteer') {
      let body = '';
      req.on('data', chunk => { body += chunk });
      req.on('end', async () => {
        const volunteer = JSON.parse(body);
        const result = await db.collection('volunteer').insertOne(volunteer);
        return res.status(201).json(result);
      });
      return;
    }

    if (method === 'GET' && url.startsWith('/volunteer/')) {
      const id = url.split('/')[2];
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
      const result = await db.collection('volunteer').findOne({ _id: new ObjectId(id) });
      if (!result) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(result);
    }

    if (method === 'PATCH' && url.endsWith('/decrease')) {
      const id = url.split('/')[2];
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
      const result = await db.collection('volunteer').updateOne(
        { _id: new ObjectId(id) },
        { $inc: { volunteersNeeded: -1 } }
      );
      return res.status(200).json(result);
    }

    if (method === 'DELETE' && url.startsWith('/volunteer/')) {
      const id = url.split('/')[2];
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
      const result = await db.collection('volunteer').deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json(result);
    }

    if (method === 'POST' && url === '/applications') {
      let body = '';
      req.on('data', chunk => { body += chunk });
      req.on('end', async () => {
        const data = JSON.parse(body);
        const result = await db.collection('applications').insertOne(data);
        return res.status(201).json(result);
      });
      return;
    }

    if (method === 'GET' && url === '/applications') {
      const user = verifyToken();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const result = await db.collection('applications').find({ userEmail: user.email }).toArray();
      return res.status(200).json(result);
    }

    if (method === 'POST' && url === '/jwt') {
      let body = '';
      req.on('data', chunk => { body += chunk });
      req.on('end', () => {
        const { email } = JSON.parse(body);
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.setHeader('Set-Cookie', cookie.serialize('token', token, {
          httpOnly: true,
          maxAge: 86400,
          sameSite: 'Strict',
          path: '/',
          secure: true,
        }));
        return res.status(200).json({ success: true });
      });
      return;
    }

    return res.status(404).json({ error: 'Route not found' });
  } catch (err) {
    console.error('Error in API:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
