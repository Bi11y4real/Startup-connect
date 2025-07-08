require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = 'body-parser';
const cookieParser = require('cookie-parser');
const { isAuthenticated, addUserToLocals, isPaid } = require('./server/middleware/auth');

// Initialize express app and set up middleware
const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'client', 'views'));

// Stripe webhook needs raw body, so we define it before the other body parsers
const { stripeWebhook } = require('./server/controllers/stripeController');
app.post('/stripe-webhook', express.raw({type: 'application/json'}), stripeWebhook);

// Middleware setup
app.use(express.static(path.join(__dirname, 'client', 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cookie parser with secret
app.use(cookieParser(process.env.COOKIE_SECRET || 'your-secret-key'));

// Trust first proxy (important if behind a reverse proxy like nginx)
app.set('trust proxy', 1);

// Add user and path to res.locals for all views
app.use((req, res, next) => {
    res.locals.path = req.path;
    next();
});

// Add user to res.locals for all views
app.use(addUserToLocals);

// Import routes
const indexRoutes = require('./server/routes/index');
const authRoutes = require('./server/routes/auth');
const projectRoutes = require('./server/routes/projects');
const dashboardRoutes = require('./server/routes/dashboard');
<<<<<<< HEAD
const collaborationsRoutes = require('./server/routes/collaborations');
const applicationsRoutes = require('./server/routes/applications');
const analyticsRoutes = require('./server/routes/analytics');
const usersRoutes = require('./server/routes/users');
=======
const collaborationsRoutes =require('./server/routes/collaborations');
const paymentRoutes = require('./server/routes/payment');
>>>>>>> 226afc0ef0ecc132dc3f5a9ec1f23d5ffdff809a

// Public routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);

// Protected routes
app.use('/projects', isAuthenticated, isPaid, projectRoutes);
app.use('/dashboard', isAuthenticated, dashboardRoutes);
app.use('/collaborations', isAuthenticated, collaborationsRoutes);
<<<<<<< HEAD
app.use('/applications', isAuthenticated, applicationsRoutes);
app.use('/analytics', isAuthenticated, analyticsRoutes);
app.use('/users', isAuthenticated, usersRoutes);
// app.use('/profile', userRoutes);
=======
app.use('/payment', paymentRoutes); // The routes inside payment.js already handle isAuthenticated
>>>>>>> 226afc0ef0ecc132dc3f5a9ec1f23d5ffdff809a

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Function to find an available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = app.listen(startPort)
      .on('listening', () => {
        server.close(() => resolve(startPort));
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(findAvailablePort(startPort + 1));
        } else {
          reject(err);
        }
      });
  });
};

// Start server with port fallback
findAvailablePort(PORT)
  .then(port => {
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });