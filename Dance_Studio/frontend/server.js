// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const User = require('./models/User'); // Import User model for seeding
const path = require('path'); // <<< 1. IMPORT THE PATH MODULE

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(express.json()); // Allows parsing JSON body data

// ** START OF FIX: Corrected path for frontend files **
// 2. USE path.join to point to the folder one level up ('..') and then into 'frontend'
// This path is now C:\Users\akhil\OneDrive\Documents\dance mern\frontend
app.use(express.static(path.join(__dirname, '..', 'frontend'))); 
// ** END OF FIX **


// Basic CORS setup to allow the frontend to communicate
app.use((req, res, next) => {
  // Allow requests from all origins (for development)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully.');
    seedUser(); // Run seeding function after successful connection
  })
  .catch(err => console.error('MongoDB connection error:', err));


// --- Routes ---
// This handles all your API routes like /api/auth/forgotpassword
app.use('/api/auth', authRoutes);

// Simple test route (If your frontend folder doesn't have index.html, this is served)
app.get('/', (req, res) => {
  res.send('Dance Studio API is running...');
});

// --- Seeding Function for Initial User ---
async function seedUser() {
  try {
    const email = 'akhilareddyevuri1908@gmail.com';
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      await User.create({
        firstName: 'Akhila',
        lastName: 'Evuri',
        email: email,
        password: '1234', 
        phone: '1234567890',
        streetAddress1: '123 Seed St',
        city: 'Seed City',
        region: 'Region',
        zipCode: '10001',
        country: 'India',
        danceType: 'Bharatanatyam',
        startDate: new Date(),
        startTime: '10:00',
        isPaid: true
      });
      console.log('Seed user created successfully.');
    }
  } catch (error) {
    console.error('Error seeding user:', error);
  }
}


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));