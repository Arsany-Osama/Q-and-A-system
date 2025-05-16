require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const twoFaRoutes = require('./routes/twofaRoutes');
const questionRoutes = require('./routes/questionRoutes');
const answerRoutes = require('./routes/answerRoutes');
const voteRoutes = require('./routes/voteRoutes');
const replyRoutes = require('./routes/replyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const documentRoutes = require('./routes/documentRoutes'); // Added
const userRoutes = require('./routes/userRoutes');
const passport = require('./services/passport');
const https = require('https');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors({
  origin: 'https://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true, //https only
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../..', 'client')));

// Routes
app.use('/auth', authRoutes);
app.use('/questions', questionRoutes);
app.use('/answers', answerRoutes);
app.use('/vote', voteRoutes);
app.use('/replies', replyRoutes);
app.use('/admin', adminRoutes);
app.use('/auth/2fa', twoFaRoutes);
app.use('/documents', documentRoutes); // Added
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Fallback route for client-side routing (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Load SSL cert and key
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem')),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`HTTPS server running at https://localhost:${PORT}`);
});

// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
