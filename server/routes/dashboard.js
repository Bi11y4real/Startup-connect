const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../config/firebase');
const User = require('../models/user');
const Project = require('../models/project');
const { isAuthenticated } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../client/public/uploads/projects'))
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Dashboard home - Projects view
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { role } = req.user;
        let viewData = {
            title: 'Dashboard | StartupConnect',
            role: role
        };

        // Get role-specific data
        switch (role) {
            case 'founder':
                // Get founder's projects and stats
                const stats = await Project.getStats(req.user.id);
                const projects = await Project.getByFounderId(req.user.id);
                viewData = {
                    ...viewData,
                    projects,
                    activeProjects: stats.activeProjects,
                    totalInvestment: stats.totalInvestment,
                    totalCollaborators: stats.totalCollaborators
                };
                break;

            case 'investor':
                // Get investment opportunities
                const availableProjects = await Project.getAvailableForInvestment();
                viewData = {
                    ...viewData,
                    projects: availableProjects
                };
                break;

            case 'collaborator':
                // Get collaboration opportunities
                const collaborationProjects = await Project.getAvailableForCollaboration();
                viewData = {
                    ...viewData,
                    projects: collaborationProjects
                };
                break;

            default:
                viewData.projects = [];
        }

        // Render the appropriate dashboard view
        res.render('dashboard/index', viewData);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load dashboard'
        });
    }
});

// Filter projects by status
router.get('/projects/:status', isAuthenticated, async (req, res) => {
    try {
        const { status } = req.params;
        const validStatuses = ['active', 'completed'];
        
        if (!validStatuses.includes(status)) {
            return res.redirect('/dashboard');
        }

        // Get project statistics
        const stats = await Project.getStats(req.user.id);
        
        // Get filtered projects
        const projects = await Project.getByStatus(req.user.id, status);

        res.render('dashboard/projects', {
            title: `${status.charAt(0).toUpperCase() + status.slice(1)} Projects | StartupConnect`,
            projects,
            activeProjects: stats.activeProjects,
            totalInvestment: stats.totalInvestment,
            totalCollaborators: stats.totalCollaborators,
            currentStatus: status
        });
    } catch (error) {
        console.error('Error filtering projects:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load projects'
        });
    }
});

// Update project status
router.post('/projects/:id/status', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const project = await Project.getById(id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is the project owner
        if (project.founderId !== req.user.id) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await Project.updateStatus(id, status);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error updating project status:', error);
        res.status(500).json({ error: 'Failed to update project status' });
    }
});

// Projects management routes
router.get('/projects', isAuthenticated, async (req, res) => {
    try {
        const projects = await Project.getByFounderId(req.user.id);
        const stats = await Project.getStats(req.user.id);
        
        res.render('dashboard/projects', {
            title: 'My Projects | StartupConnect',
            projects,
            activeProjects: stats.activeProjects,
            totalInvestment: stats.totalInvestment,
            totalCollaborators: stats.totalCollaborators
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load projects'
        });
    }
});

router.get('/projects/new', isAuthenticated, (req, res) => {
    res.render('dashboard/project-form', {
        title: 'Create New Project | StartupConnect',
        project: null
    });
});

router.post('/projects/new', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const projectData = {
            title: req.body.title,
            description: req.body.description,
            industry: req.body.industry,
            fundingGoal: parseFloat(req.body.fundingGoal),
            skills: req.body.skills.split(',').map(skill => skill.trim()),
            imageUrl: req.file ? `/uploads/projects/${req.file.filename}` : null,
            founderId: req.user.id,
            founderName: req.user.name,
            isCompleted: false
        };

        await Project.create(projectData);
        res.redirect('/dashboard/projects');
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).send('Error creating project');
    }
});

router.get('/projects/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        
        if (!project) {
            return res.status(404).render('404', { title: '404 - Project Not Found' });
        }

        if (project.founderId !== req.user.id) {
            return res.status(403).send('Unauthorized');
        }

        res.render('dashboard/project-form', {
            title: 'Edit Project | StartupConnect',
            project
        });
    } catch (error) {
        console.error('Error loading project:', error);
        res.status(500).send('Error loading project');
    }
});

router.post('/projects/:id/edit', isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        
        if (!project || project.founderId !== req.user.id) {
            return res.status(403).send('Unauthorized');
        }

        const projectData = {
            title: req.body.title,
            description: req.body.description,
            industry: req.body.industry,
            fundingGoal: parseFloat(req.body.fundingGoal),
            skills: req.body.skills.split(',').map(skill => skill.trim())
        };

        if (req.file) {
            projectData.imageUrl = `/uploads/projects/${req.file.filename}`;
        }

        await Project.update(req.params.id, projectData);
        res.redirect('/dashboard/projects');
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).send('Error updating project');
    }
});

// Delete project
router.post('/projects/:id/delete', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);

        if (!project) {
            return res.status(404).render('error', {
                title: 'Error',
                message: 'Project not found'
            });
        }

        // Check if user is the project owner
        if (project.founderId !== req.user.id) {
            return res.status(403).render('error', {
                title: 'Error',
                message: 'You do not have permission to delete this project'
            });
        }

        await Project.delete(id);
        res.redirect('/dashboard/projects');
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to delete project'
        });
    }
});

// Profile management routes
router.get('/profile', isAuthenticated, (req, res) => {
    res.render('dashboard/profile', {
        title: 'My Profile | StartupConnect',
        user: req.user
    });
});

router.post('/profile', isAuthenticated, async (req, res) => {
    try {
        const userData = {
            name: req.body.name,
            email: req.body.email
        };

        // Add role-specific fields
        if (req.user.role === 'founder') {
            userData.company = req.body.company;
            userData.industry = req.body.industry;
        } else if (req.user.role === 'collaborator') {
            userData.skills = req.body.skills.split(',').map(skill => skill.trim());
            userData.experience = parseInt(req.body.experience);
        } else if (req.user.role === 'investor') {
            userData.investmentRange = req.body.investmentRange;
            userData.interests = req.body.interests.split(',').map(interest => interest.trim());
        }

        await User.update(req.user.id, userData);

        if (req.body.currentPassword && req.body.newPassword) {
            // TODO: Implement password change using Firebase Auth
        }

        res.redirect('/dashboard/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Error updating profile');
    }
});

module.exports = router; 