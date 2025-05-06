require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const answerRoutes = require('./routes/answerRoutes');
const voteRoutes = require('./routes/voteRoutes');
const passport = require('./services/passport');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../..', 'client')));

// Routes
app.use('/auth', authRoutes);
app.use('/questions', questionRoutes);
app.use('/answers', answerRoutes);
app.use('/vote', voteRoutes);

// Fallback route for client-side routing (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
