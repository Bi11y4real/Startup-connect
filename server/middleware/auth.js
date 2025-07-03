const { auth, adminAuth, adminDb } = require('../config/firebase');
const User = require('../models/user');
const { db } = require('../config/firebase');
const { doc, getDoc } = require('firebase/firestore');

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        
        // Get user data from Firestore
        const userData = await User.getById(decodedToken.uid);
        if (!userData) {
            throw new Error('User not found in database');
        }

        req.user = {
            id: decodedToken.uid,
            email: decodedToken.email,
            name: userData.name,
            role: userData.role,
            ...userData
        };

        // Add user to locals for views
        res.locals.user = req.user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.clearCookie('token');
        res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
};

// Middleware to check if user is NOT authenticated (for login/signup pages)
const isNotAuthenticated = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (token) {
            const decodedToken = await adminAuth.verifyIdToken(token);
            return res.redirect('/dashboard');
        }
        next();
    } catch (error) {
        res.clearCookie('token');
        next();
    }
};

// Middleware to check user roles
const hasRole = (roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
            }

            if (!Array.isArray(roles)) {
                roles = [roles];
            }

            if (!roles.includes(req.user.role)) {
                return res.status(403).render('error', {
                    title: '403 - Access Denied',
                    message: 'You do not have permission to access this resource'
                });
            }

            next();
        } catch (error) {
            console.error('Role check error:', error);
            res.status(403).render('error', {
                title: '403 - Access Denied',
                message: 'Error checking permissions'
            });
        }
    };
};

// Middleware to add user to locals for all views
const addUserToLocals = async (req, res, next) => {
    try {
        // Debug logging
        console.log('Cookies:', req.cookies);
        
        const token = req.cookies ? req.cookies.token : null;
        console.log('Token exists:', !!token);
        
        if (token) {
            try {
                console.log('Verifying token...');
                const decodedToken = await adminAuth.verifyIdToken(token);
                console.log('Token verified. User ID:', decodedToken.uid);
                
                const userData = await User.getById(decodedToken.uid);
                console.log('User data from Firestore:', userData ? 'Found' : 'Not found');
                
                if (userData) {
                    const user = {
                        id: decodedToken.uid,
                        email: decodedToken.email,
                        name: userData.name,
                        role: userData.role,
                        ...userData
                    };
                    
                    // Set on both res.locals and req.user for consistency
                    res.locals.user = user;
                    req.user = user;
                    
                    console.log('User set in locals:', { id: user.id, email: user.email, role: user.role });
                } else {
                    console.log('User data not found in Firestore');
                    res.locals.user = null;
                    req.user = null;
                }
            } catch (tokenError) {
                console.error('Token verification failed:', tokenError.message);
                // Clear invalid token
                res.clearCookie('token', {
                    path: '/',
                    domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined
                });
                res.locals.user = null;
                req.user = null;
            }
        } else {
            console.log('No token found in cookies');
            res.locals.user = null;
            req.user = null;
        }
        
        // Make sure user is available in the view
        res.locals.user = res.locals.user || null;
        next();
    } catch (error) {
        console.error('Error in addUserToLocals middleware:', error);
        res.locals.user = null;
        req.user = null;
        next();
    }
};

// Middleware to check if user is project owner
const isProjectOwner = async (userId, projectId) => {
    try {
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            return false;
        }
        const projectData = projectDoc.data();
        return projectData.founderId === userId;
    } catch (error) {
        console.error('Error checking project ownership:', error);
        return false;
    }
};

module.exports = {
    isAuthenticated,
    isNotAuthenticated,
    hasRole,
    addUserToLocals,
    isProjectOwner
}; 