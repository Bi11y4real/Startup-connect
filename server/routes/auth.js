const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../config/firebase');
const { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signInWithCredential,
    GoogleAuthProvider,
    sendPasswordResetEmail
} = require('firebase/auth');
const User = require('../models/user');
const { isNotAuthenticated } = require('../middleware/auth');

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Login routes
router.get('/login', isNotAuthenticated, (req, res) => {
    const redirect = req.query.redirect || '/dashboard';
    res.render('auth/login', {
        title: 'Login | StartupConnect',
        redirect
    });
});

router.post('/login', isNotAuthenticated, async (req, res) => {
    try {
        const { email, password } = req.body;
        const redirect = req.query.redirect || '/dashboard';

        // Validate input
        if (!email || !password) {
            return res.render('auth/login', {
                title: 'Login | StartupConnect',
                error: 'Please provide both email and password',
                redirect
            });
        }

        console.log('Attempting to sign in user with email:', email);
        
        // Sign in user
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Firebase authentication successful');
        
        // Get user data from Firestore
        console.log('Fetching user data from Firestore...');
        const user = await User.getById(userCredential.user.uid);
        if (!user) {
            console.error('User authenticated but not found in Firestore:', userCredential.user.uid);
            throw new Error('User not found in database');
        }
        console.log('User data retrieved successfully');

        // Create session token
        console.log('Generating session token...');
        const token = await userCredential.user.getIdToken();
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
            domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined,
            path: '/'
        });
        console.log('Session token set in cookie');

        res.redirect(redirect);
    } catch (error) {
        console.error('Login error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = 'Invalid email or password';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed login attempts. Please try again later';
        }
        
        res.render('auth/login', {
            title: 'Login | StartupConnect',
            error: errorMessage,
            redirect: req.query.redirect || '/dashboard'
        });
    }
});

// Password reset routes
router.get('/forgot-password', isNotAuthenticated, (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password | StartupConnect'
    });
});

router.post('/forgot-password', isNotAuthenticated, async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.render('auth/forgot-password', {
                title: 'Forgot Password | StartupConnect',
                error: 'Please enter your email address'
            });
        }

        // Send password reset email
        await sendPasswordResetEmail(auth, email);
        
        res.render('auth/forgot-password', {
            title: 'Forgot Password | StartupConnect',
            success: 'Password reset instructions have been sent to your email'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.render('auth/forgot-password', {
            title: 'Forgot Password | StartupConnect',
            error: 'Failed to send password reset email. Please try again.'
        });
    }
});

// Register page
router.get('/register', isNotAuthenticated, (req, res) => {
    res.render('auth/register', {
        title: 'Register | StartupConnect',
        roles: [
            { id: 'founder', name: 'Founder', description: 'Create and manage startup projects' },
            { id: 'investor', name: 'Investor', description: 'Invest in promising startups' },
            { id: 'collaborator', name: 'Collaborator', description: 'Join and contribute to startup projects' }
        ]
    });
});

// Handle registration
router.post('/register', isNotAuthenticated, async (req, res) => {
    try {
        console.log('Registration request received:', req.body);
        const { email, password, role, name } = req.body;

        // Validate input
        if (!email || !password || !role || !name) {
            const error = 'Please fill in all required fields';
            if (req.headers['content-type'] === 'application/json') {
                return res.status(400).json({ error });
            }
            return res.render('auth/register', {
                title: 'Register | StartupConnect',
                error,
                roles: [
                    { id: 'founder', name: 'Founder', description: 'Create and manage startup projects' },
                    { id: 'investor', name: 'Investor', description: 'Invest in promising startups' },
                    { id: 'collaborator', name: 'Collaborator', description: 'Join and contribute to startup projects' }
                ]
            });
        }

        // Validate role
        const validRoles = ['founder', 'investor', 'collaborator'];
        if (!validRoles.includes(role)) {
            const error = 'Invalid role selected';
            if (req.headers['content-type'] === 'application/json') {
                return res.status(400).json({ error });
            }
            throw new Error(error);
        }

        // Create user in Firebase Auth
        console.log('Creating user in Firebase Auth...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user in Firestore
        console.log('Creating user in Firestore...');
        await User.create(userCredential.user.uid, {
            email,
            name,
            role,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Get ID token
        console.log('Getting ID token...');
        const token = await userCredential.user.getIdToken();
        
        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
        });

        // Return response based on request type
        if (req.headers['content-type'] === 'application/json') {
            return res.json({ redirect: '/dashboard' });
        }
        
        
        // Redirect to main dashboard
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = error.message;
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'An account with this email already exists';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        }

        if (req.headers['content-type'] === 'application/json') {
            return res.status(400).json({ error: errorMessage });
        }

        res.render('auth/register', {
            title: 'Register | StartupConnect',
            error: errorMessage,
            roles: [
                { id: 'founder', name: 'Founder', description: 'Create and manage startup projects' },
                { id: 'investor', name: 'Investor', description: 'Invest in promising startups' },
                { id: 'collaborator', name: 'Collaborator', description: 'Join and contribute to startup projects' }
            ]
        });
    }
});

// Handle logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// Google Sign In callback
router.post('/google/callback', async (req, res) => {
    try {
        console.log('Received Google callback request');
        const { token, email, displayName, photoURL } = req.body;

        if (!token) {
            throw new Error('No token provided');
        }

        console.log('Verifying token...');
        // Verify the ID token using Admin SDK
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;
        console.log('Token verified for user:', uid);

        // Check if user exists in our database
        let userData = await User.getById(uid);
        console.log('User data from database:', userData);
        
        if (!userData) {
            console.log('Creating new user in database...');
            // Create new user in our database
            userData = await User.create(uid, {
                name: displayName,
                email: email,
                role: 'user', // Default role
                photoURL: photoURL,
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('New user created:', userData);

            // Set the original ID token in the cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
            });

            // Return redirect to complete profile
            res.json({ redirect: '/auth/complete-profile' });
        } else {
            console.log('Existing user found');
            
            // Set the original ID token in the cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
            });

            // User exists, redirect to appropriate page
            if (!userData.role || userData.role === 'user') {
                res.json({ redirect: '/auth/complete-profile' });
            } else {
                res.json({ redirect: '/dashboard' });
            }
        }
    } catch (error) {
        console.error('Google callback error:', error);
        res.status(401).json({ 
            error: 'Authentication failed: ' + (error.message || 'Unknown error') 
        });
    }
});

// Complete profile route after Google Sign In
router.get('/complete-profile', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.redirect('/auth/login');
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const userData = await User.getById(decodedToken.uid);

        if (!userData) {
            return res.redirect('/auth/login');
        }

        res.render('complete-profile', { 
            title: 'Complete Your Profile | StartupConnect',
            user: userData
        });
    } catch (error) {
        console.error('Complete profile page error:', error);
        res.redirect('/auth/login');
    }
});

router.post('/complete-profile', async (req, res) => {
    try {
        console.log('Complete profile request received:', req.body);
        const token = req.cookies.token;
        if (!token) {
            throw new Error('Not authenticated');
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const { role, ...profileData } = req.body;
        
        // Validate role
        if (!['founder', 'collaborator', 'investor'].includes(role)) {
            throw new Error('Invalid role selected');
        }

        // Update user data with role and role-specific fields
        const userData = {
            role,
            ...profileData,
            updatedAt: new Date()
        };

        console.log('Updating user profile:', decodedToken.uid, userData);
        await User.update(decodedToken.uid, userData);

        if (req.headers['content-type'] === 'application/json') {
            return res.json({ redirect: '/dashboard' });
        }
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Complete profile error:', error);
        
        const errorMessage = error.message || 'Error updating profile';
        
        if (req.headers['content-type'] === 'application/json') {
            return res.status(400).json({ error: errorMessage });
        }
        
        res.render('complete-profile', {
            title: 'Complete Your Profile | StartupConnect',
            user: req.user,
            error: errorMessage
        });
    }
});

module.exports = router; 