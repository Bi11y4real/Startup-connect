const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { hasRole } = require('../middleware/auth');

// All routes in this file are protected and only accessible by admins.
router.use(hasRole('admin'));

/**
 * @route   GET /users
 * @desc    Get all users with optional filtering
 * @access  Private (Admin)
 */
router.get('/', async (req, res) => {
    try {
        const { searchTerm, role, status } = req.query;
        const filters = { searchTerm, role, status };

        const users = await User.getAll(filters);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
});

/**
 * @route   GET /users/:id
 * @desc    Get a single user by ID
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res) => {
    try {
        const user = await User.getById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        console.error(`Error fetching user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error.' });
    }
});

/**
 * @route   POST /users
 * @desc    Create a new user
 * @access  Private (Admin)
 */
router.post('/', async (req, res) => {
    // Note: This is a simplified creation route. 
    // In a real-world app, you'd handle password hashing and email verification.
    try {
        const { email, password, name, role } = req.body;
        if (!email || !password || !name || !role) {
            return res.status(400).json({ message: 'Please provide email, password, name, and role.' });
        }
        // This flow assumes integration with Firebase Auth is handled separately.
        // Here we are just creating the user record in Firestore.
        // A more robust implementation would use Firebase Admin SDK to create the user.
        const newUser = await User.create(email, { email, name, role });
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Server error while creating user.' });
    }
});

/**
 * @route   PUT /users/:id
 * @desc    Update a user
 * @access  Private (Admin)
 */
router.put('/:id', async (req, res) => {
    try {
        const { name, email, role, status } = req.body;
        const updateData = { name, email, role, status };

        // Remove undefined fields so we don't overwrite existing data with nulls
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const updatedUser = await User.update(req.params.id, updateData);
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(updatedUser);
    } catch (error) {
        console.error(`Error updating user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while updating user.' });
    }
});

// Hard delete a user
router.delete('/:id', hasRole('admin'), async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.getById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        await User.delete(userId);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
});

module.exports = router;
