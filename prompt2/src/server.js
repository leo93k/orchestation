const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', require('./routes/api'));

// Redirect routes (must be last)
app.use('/', require('./routes/redirect'));

app.listen(PORT, () => {
  console.log(`🔗 URL Shortener running at http://localhost:${PORT}`);
});

module.exports = app;
