const express = require('express');
const router = express.Router();
const { auth } = require('../config/firebase');
const CollaborationRequest = require('../models/collaborationRequest');
const { isAuthenticated, isProjectOwner } = require('../middleware/auth');
const Project = require('../models/project');

// Send collaboration request
router.post(['/:projectId', '/request/:projectId'], isAuthenticated, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { role, message } = req.body;
        const userId = req.user.id;
        const userName = req.user.name;

        console.log('Creating collaboration request:', {
            projectId,
            userId,
            userName,
            role
        });

        // Validate input
        if (!role || !message) {
            return res.status(400).json({ error: 'Role and message are required' });
        }

        // Check if user is already a collaborator
        const project = await Project.getById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const isCollaborator = project.collaborators?.some(
            c => c.userId === userId
        );

        if (isCollaborator) {
            return res.status(400).json({
                error: 'You are already a collaborator on this project'
            });
        }

        // Create unique request ID
        const requestId = `${projectId}_${userId}_${Date.now()}`;

        // Create collaboration request
        await CollaborationRequest.create(requestId, {
            projectId,
            projectTitle: project.title,
            collaboratorId: userId,
            collaboratorName: userName,
            role,
            message,
            status: 'pending'
        });

        console.log('Collaboration request created successfully:', requestId);

        // Redirect back to project page with success message
        res.redirect(`/projects/${projectId}?success=1&message=Collaboration%20request%20sent%20successfully`);
    } catch (error) {
        console.error('Error creating collaboration request:', error);
        res.status(500).json({ error: 'Failed to send collaboration request' });
    }
});

// Get collaboration requests for a project
router.get('/requests/:projectId', isAuthenticated, async (req, res) => {
    try {
        const { projectId } = req.params;
        
        console.log('Getting collaboration requests for project:', projectId);
        
        // Check if user is project owner
        if (!await isProjectOwner(req.user.id, projectId)) {
            console.log('User is not project owner:', req.user.id);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const requests = await CollaborationRequest.getByProject(projectId);
        console.log('Found collaboration requests:', requests);
        
        res.json(requests);
    } catch (error) {
        console.error('Error getting collaboration requests:', error);
        res.status(500).json({ error: 'Failed to get collaboration requests' });
    }
});

// Handle collaboration request (accept/reject)
router.put('/request/:requestId/:action', isAuthenticated, async (req, res) => {
    try {
        const { requestId, action } = req.params;
        const { projectId } = req.body;
        
        console.log('Handling collaboration request:', {
            requestId,
            action,
            projectId,
            userId: req.user.id
        });
        
        // Check if user is project owner
        if (!await isProjectOwner(req.user.id, projectId)) {
            console.log('User is not project owner:', req.user.id);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Validate action
        if (action !== 'accept' && action !== 'reject') {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Get request details
        const request = await CollaborationRequest.getById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Collaboration request not found' });
        }

        // Map action to status
        const status = action === 'accept' ? 'accepted' : 'rejected';
        
        // Update request status
        await CollaborationRequest.updateStatus(requestId, status);

        if (action === 'accept') {
            // Add collaborator to project
            await Project.addCollaborator(projectId, request.collaboratorId, request.role);
            console.log('Added collaborator to project:', {
                projectId,
                collaboratorId: request.collaboratorId,
                role: request.role
            });
        }

        console.log('Successfully handled collaboration request');

        res.json({ 
            success: true, 
            message: `Request ${action}ed successfully`,
            requestId
        });
    } catch (error) {
        console.error('Error handling collaboration request:', error);
        res.status(500).json({ error: 'Failed to handle collaboration request' });
    }
});

module.exports = router;
