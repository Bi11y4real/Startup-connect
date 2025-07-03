const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/project');
const CollaborationRequest = require('../models/collaborationRequest');
const { isAuthenticated, hasRole, auth } = require('../middleware/auth');
const User = require('../models/user');
const { db, adminDb } = require('../config/firebase');
const { 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    serverTimestamp 
} = require('firebase/firestore');
const admin = require('firebase-admin');

// Verify CollaborationRequest is loaded
console.log('CollaborationRequest module loaded:', CollaborationRequest);

// Configure multer for memory storage
const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check if it's an image
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }

        // Check file extension
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
        const extension = file.originalname.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            return cb(new Error('Only .jpg, .jpeg, .png, and .gif files are allowed'));
        }

        cb(null, true);
    }
});

// Wrapper for multer error handling
const uploadMiddleware = (req, res, next) => {
    multerUpload.single('image')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.render('projects/new', {
                title: 'Create New Project | StartupConnect',
                error: `File upload error: ${err.message}`,
                formData: req.body
            });
        } else if (err) {
            return res.render('projects/new', {
                title: 'Create New Project | StartupConnect',
                error: err.message,
                formData: req.body
            });
        }
        next();
    });
};

// List all projects
router.get('/', async (req, res) => {
    try {
        const { industry, status, search } = req.query;
        const searchOptions = {
            industry: industry || null,
            status: status || null,
            searchTerm: search || null
        };

        const { projects } = await Project.search(searchOptions);
        
        // Convert timestamps to dates
        const processedProjects = projects.map(project => ({
            ...project,
            createdAt: project.createdAt ? new Date(project.createdAt) : null,
            updatedAt: project.updatedAt ? new Date(project.updatedAt) : null,
            fundingRaised: project.fundingRaised || 0,
            collaborators: project.collaborators || []
        }));

        res.render('projects/index', {
            title: 'Explore Projects | StartupConnect',
            projects: processedProjects,
            filters: {
                industry,
                status,
                search
            }
        });
    } catch (error) {
        console.error('Error listing projects:', error.message);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load projects'
        });
    }
});

// Show project creation form
router.get('/new', isAuthenticated, hasRole(['founder']), (req, res) => {
    res.render('projects/new', {
        title: 'Create New Project | StartupConnect',
        formData: {}
    });
});

// Create new project
router.post('/', isAuthenticated, hasRole(['founder']), uploadMiddleware, async (req, res) => {
    try {
        const {
            title,
            description,
            industry,
            fundingGoal,
            timeline,
            location,
            website,
            pitch
        } = req.body;

        // Validate required fields
        if (!title || !description || !industry || !fundingGoal) {
            return res.render('projects/new', {
                title: 'Create New Project | StartupConnect',
                error: 'Please fill in all required fields',
                formData: req.body
            });
        }

        const projectData = {
            title,
            description,
            industry,
            fundingGoal: parseInt(fundingGoal),
            timeline,
            location,
            website,
            pitch
        };

        const projectId = await Project.create(req.user.id, projectData, req.file);
        res.redirect(`/projects/${projectId}`);
    } catch (error) {
        console.error('Project creation error:', error.message);
        res.render('projects/new', {
            title: 'Create New Project | StartupConnect',
            error: 'Failed to create project. Please try again.',
            formData: req.body
        });
    }
});

// Show project details
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        if (!project) {
            return res.status(404).render('error', {
                title: '404 - Project Not Found',
                message: 'The requested project could not be found'
            });
        }

        // Get collaboration requests for project owner
        let collaborationRequests = [];
        let isOwner = false;
        let collaborationRequest = null;
        
        console.log('User data:', {
            isAuthenticated: !!req.user,
            userId: req.user?.id,
            userRole: req.user?.role,
            userName: req.user?.name
        });

        console.log('Project data:', {
            id: project.id,
            founderId: project.founderId,
            collaboratorsCount: project.collaborators?.length || 0,
            collaborators: project.collaborators
        });
        
        if (req.user) {
            isOwner = req.user.id === project.founderId;
            console.log('Ownership check:', {
                isOwner,
                userId: req.user.id,
                founderId: project.founderId
            });
            
            if (isOwner) {
                // Get all collaboration requests if user is project owner
                collaborationRequests = await CollaborationRequest.getByProject(req.params.id);
                console.log('Collaboration requests for owner:', collaborationRequests);
            } else {
                // Check if current user has a pending request
                collaborationRequest = await CollaborationRequest.getByUserAndProject(req.user.id, req.params.id);
                console.log('User collaboration request:', collaborationRequest);
            }
        }

        // Convert timestamps to dates
        const processedProject = {
            ...project,
            createdAt: project.createdAt ? new Date(project.createdAt) : null,
            updatedAt: project.updatedAt ? new Date(project.updatedAt) : null,
            fundingRaised: project.fundingRaised || 0,
            fundingGoal: project.fundingGoal || 0,
            skills: project.skills || [],
            collaborators: project.collaborators || []
        };

        console.log('Rendering project detail with data:', {
            isAuthenticated: !!req.user,
            userRole: req.user?.role,
            isOwner,
            hasCollaborationRequest: !!collaborationRequest,
            collaboratorsCount: processedProject.collaborators.length
        });

        res.render('project-detail', {
            title: `${project.title} | StartupConnect`,
            project: processedProject,
            user: req.user,
            isOwner,
            collaborationRequests,
            collaborationRequest,
            query: req.query
        });
    } catch (error) {
        console.error('Error getting project:', error.message);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load project'
        });
    }
});

// Handle collaboration submission
router.post('/:id/collaborate', isAuthenticated, async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        if (!project) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(404).json({ success: false, error: 'Project not found' });
            }
            return res.status(404).render('error', {
                title: '404 - Project Not Found',
                message: 'The requested project could not be found'
            });
        }

        // Check if user is already a collaborator
        const isCollaborator = project.collaborators?.some(c => c.userId === req.user.id);
        if (isCollaborator) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(400).json({ success: false, error: 'You are already a collaborator on this project' });
            }
            return res.redirect(`/projects/${req.params.id}?error=1&message=You are already a collaborator on this project`);
        }

        // Check for existing pending request
        const existingRequest = await CollaborationRequest.getByUserAndProject(req.user.id, req.params.id);
        if (existingRequest) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(400).json({ success: false, error: 'You already have a pending request for this project' });
            }
            return res.redirect(`/projects/${req.params.id}?error=1&message=You already have a pending request for this project`);
        }

        // Create new collaboration request
        const requestId = `${req.user.id}_${req.params.id}_${Date.now()}`;
        await CollaborationRequest.create(requestId, {
            projectId: req.params.id,
            projectTitle: project.title,
            collaboratorId: req.user.id,
            collaboratorName: req.user.name,
            role: req.body.role,
            message: req.body.message,
            status: 'pending'
        });

        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({ success: true, message: 'Collaboration request sent successfully' });
        }
        return res.redirect(`/projects/${req.params.id}?success=1&message=Your collaboration request has been sent successfully`);
    } catch (error) {
        console.error('Error creating collaboration request:', error);
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Failed to send collaboration request' });
        }
        return res.redirect(`/projects/${req.params.id}?error=1&message=Failed to send collaboration request`);
    }
});

// Show collaboration form
router.get('/:id/collaborate', isAuthenticated, async (req, res) => {
    try {
        console.log('Collaboration route hit for project ID:', req.params.id);
        console.log('Authenticated user ID:', req.user?.id);
        
        const project = await Project.getById(req.params.id);
        if (!project) {
            console.log('Project not found:', req.params.id);
            return res.status(404).render('error', {
                title: '404 - Project Not Found',
                message: 'The requested project could not be found'
            });
        }

        console.log('Project found. Collaborators:', project.collaborators);
        
        // Check if user is already a collaborator
        const isCollaborator = project.collaborators?.some(c => c.userId === req.user.id);
        console.log('Is user already a collaborator?', isCollaborator);
        
        if (isCollaborator) {
            console.log('User is already a collaborator, redirecting to project page');
            return res.redirect(`/projects/${req.params.id}`);
        }

        console.log('Rendering collaboration form');
        res.render('projects/collaborate', {
            title: `Collaborate with ${project.title} | StartupConnect`,
            project
        });
    } catch (error) {
        console.error('Error getting project:', error.message);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load project'
        });
    }
});

// Manage collaboration requests (for project owners)
router.get('/:id/manage-collaborations', isAuthenticated, async (req, res) => {
    try {
        console.log('Manage collaborations route hit for project ID:', req.params.id);
        console.log('Authenticated user:', {
            id: req.user.id,
            role: req.user.role,
            name: req.user.name
        });
        
        const project = await Project.getById(req.params.id);
        if (!project) {
            console.log('Project not found:', req.params.id);
            return res.status(404).render('error', {
                title: '404 - Project Not Found',
                message: 'The requested project could not be found'
            });
        }

        console.log('Project found:', {
            id: project.id,
            title: project.title,
            founderId: project.founderId
        });

        // Check if user is project owner
        if (project.founderId !== req.user.id) {
            console.log('User is not project owner:', {
                userId: req.user.id,
                founderId: project.founderId
            });
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                message: 'You do not have permission to manage collaborations'
            });
        }

        console.log('User is project owner, fetching collaboration requests');
        const requests = await CollaborationRequest.getByProject(req.params.id);
        console.log('Found collaboration requests:', requests);

        res.render('projects/manage-collaborations', {
            title: `Manage Collaborations for ${project.title} | StartupConnect`,
            project,
            requests
        });
    } catch (error) {
        console.error('Error getting project:', error.message);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load collaboration requests'
        });
    }
});

// Edit project form
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        if (!project) {
            return res.status(404).render('error', {
                title: '404 - Project Not Found',
                message: 'The requested project could not be found'
            });
        }

        // Check if user is the project owner
        if (project.founderId !== req.user.id) {
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                message: 'You do not have permission to edit this project'
            });
        }

        res.render('projects/edit', {
            title: `Edit ${project.title} | StartupConnect`,
            project
        });
    } catch (error) {
        console.error('Error getting project:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load project'
        });
    }
});

// Update project
router.post('/:id', isAuthenticated, uploadMiddleware, async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        if (!project) {
            return res.status(404).render('error', {
                title: '404 - Project Not Found',
                message: 'The requested project could not be found'
            });
        }

        // Check if user is the project owner
        if (project.founderId !== req.user.id) {
            return res.status(403).render('error', {
                title: '403 - Forbidden',
                message: 'You do not have permission to edit this project'
            });
        }

        const {
            title,
            description,
            industry,
            fundingGoal,
            timeline,
            location,
            website,
            pitch
        } = req.body;

        const updateData = {
            title,
            description,
            industry,
            fundingGoal: parseInt(fundingGoal),
            timeline,
            location,
            website,
            pitch
        };

        await Project.update(req.params.id, updateData, req.file);
        res.redirect(`/projects/${req.params.id}`);
    } catch (error) {
        console.error('Error updating project:', error);
        res.render('projects/edit', {
            title: 'Edit Project | StartupConnect',
            error: 'Failed to update project: ' + error.message,
            project: { id: req.params.id, ...req.body }
        });
    }
});

// Delete project
router.post('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        const project = await Project.getById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if user is the project owner
        if (project.founderId !== req.user.id) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        await Project.delete(req.params.id);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Add collaborator to project
router.post('/:id/collaborators', isAuthenticated, async (req, res) => {
    try {
        const { role } = req.body;
        await Project.addCollaborator(req.params.id, req.user.id, role);
        res.redirect(`/projects/${req.params.id}`);
    } catch (error) {
        console.error('Error adding collaborator:', error);
        res.status(500).json({ error: 'Failed to add collaborator' });
    }
});

// Investment route
router.post('/:id/invest', isAuthenticated, hasRole(['investor']), async (req, res) => {
    try {
        const { amount } = req.body;
        const projectId = req.params.id;
        const investorId = req.user.id;

        // Validate amount
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid investment amount' });
        }

        // Get project and investor details
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();
        const investorRef = adminDb.collection('users').doc(investorId);
        const investorDoc = await investorRef.get();

        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const project = projectDoc.data();
        const investor = investorDoc.data();

        // Check if project is still accepting investments
        if (project.fundingRaised >= project.fundingGoal) {
            return res.status(400).json({ error: 'Project has already reached its funding goal' });
        }

        const currentTimestamp = new Date().toISOString();
        const parsedAmount = parseFloat(amount);

        // Create new investor record
        const newInvestor = {
            userId: investorId,
            name: investor.name || 'Anonymous Investor',
            amount: parsedAmount,
            joinedAt: currentTimestamp
        };

        // Only add avatar if it exists
        if (investor.avatar) {
            newInvestor.avatar = investor.avatar;
        }

        // Create investment record
        const investment = {
            amount: parsedAmount,
            investorId: investorId,
            investorName: investor.name || 'Anonymous Investor',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            projectId: projectId,
            projectTitle: project.title
        };

        // Only add avatar if it exists
        if (investor.avatar) {
            investment.investorAvatar = investor.avatar;
        }

        // Prepare project update data
        const projectUpdate = {
            fundingRaised: (project.fundingRaised || 0) + parsedAmount,
            investors: admin.firestore.FieldValue.arrayUnion(newInvestor)
        };

        // Update project's funding raised
        await projectRef.update(projectUpdate);

        // Prepare investor update data
        const investmentRecord = {
            projectId: projectId,
            projectTitle: project.title,
            amount: parsedAmount,
            investedAt: currentTimestamp
        };

        // Update user's investments using arrayUnion to prevent duplicates
        await investorRef.update({
            investments: admin.firestore.FieldValue.arrayUnion(investmentRecord)
        });

        // Store the investment in a separate collection
        await adminDb.collection('investments').add(investment);

        res.json({ message: 'Investment successful', investment });
    } catch (error) {
        console.error('Error processing investment:', error);
        res.status(500).json({ error: 'Failed to process investment' });
    }
});

module.exports = router; 