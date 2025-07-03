const admin = require('firebase-admin');
const db = admin.firestore();

const VALID_STATUSES = ['pending', 'accepted', 'rejected'];

const CollaborationRequest = {
    // Create a new collaboration request
    async create(requestId, data) {
        try {
            // Validate required fields
            if (!data.projectId || !data.collaboratorId || !data.role || !data.message) {
                console.log('Missing fields:', {
                    projectId: !!data.projectId,
                    collaboratorId: !!data.collaboratorId,
                    role: !!data.role,
                    message: !!data.message
                });
                throw new Error('Missing required fields in collaboration request');
            }

            // Validate status
            if (!VALID_STATUSES.includes(data.status)) {
                data.status = 'pending';
            }

            // Remove requestId from data since it will be the document ID
            const { requestId: _, ...requestData } = data;

            const requestRef = db.collection('collaborationRequests').doc(requestId);
            await requestRef.set({
                ...requestData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log('Created collaboration request:', {
                id: requestId,
                ...requestData
            });

            return requestRef;
        } catch (error) {
            console.error('Error creating collaboration request:', error);
            throw error;
        }
    },

    // Get a collaboration request by ID
    async getById(requestId) {
        try {
            console.log('Getting collaboration request by ID:', requestId);
            const requestRef = db.collection('collaborationRequests').doc(requestId);
            const doc = await requestRef.get();
            if (!doc.exists) {
                console.log('No collaboration request found with ID:', requestId);
                return null;
            }
            const data = doc.data();
            const request = {
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? data.createdAt.toDate() : null,
                updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
            };
            console.log('Found collaboration request:', request);
            return request;
        } catch (error) {
            console.error('Error getting collaboration request:', error);
            throw error;
        }
    },

    // Get all requests for a project
    async getByProject(projectId) {
        try {
            console.log('Getting collaboration requests for project:', projectId);
            const requestsRef = db.collection('collaborationRequests')
                .where('projectId', '==', projectId)
                .orderBy('createdAt', 'desc');
            const snapshot = await requestsRef.get();
            const requests = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                requests.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt ? data.createdAt.toDate() : null,
                    updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
                });
            });
            console.log('Found collaboration requests:', requests);
            return requests;
        } catch (error) {
            console.error('Error getting project requests:', error);
            throw error;
        }
    },

    // Update request status
    async updateStatus(requestId, status) {
        try {
            console.log('Updating collaboration request status:', { requestId, status });
            if (!VALID_STATUSES.includes(status)) {
                throw new Error('Invalid status. Must be one of: ' + VALID_STATUSES.join(', '));
            }

            const requestRef = db.collection('collaborationRequests').doc(requestId);
            await requestRef.update({
                status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('Successfully updated request status');
        } catch (error) {
            console.error('Error updating collaboration request status:', error);
            throw error;
        }
    },

    // Delete a collaboration request
    async delete(requestId) {
        try {
            console.log('Deleting collaboration request:', requestId);
            const requestRef = db.collection('collaborationRequests').doc(requestId);
            await requestRef.delete();
            console.log('Successfully deleted request');
        } catch (error) {
            console.error('Error deleting collaboration request:', error);
            throw error;
        }
    },

    // Get collaboration request by user and project
    async getByUserAndProject(userId, projectId) {
        try {
            console.log('Getting collaboration request for user and project:', { userId, projectId });
            const requestsRef = db.collection('collaborationRequests')
                .where('collaboratorId', '==', userId)
                .where('projectId', '==', projectId)
                .where('status', '==', 'pending')
                .limit(1);
                
            const snapshot = await requestsRef.get();
            if (snapshot.empty) {
                console.log('No pending request found');
                return null;
            }
            
            const doc = snapshot.docs[0];
            const data = doc.data();
            const request = {
                id: doc.id,
                ...data,
                createdAt: data.createdAt ? data.createdAt.toDate() : null,
                updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
            };
            console.log('Found collaboration request:', request);
            return request;
        } catch (error) {
            console.error('Error getting user collaboration request:', error);
            throw error;
        }
    }
};

module.exports = CollaborationRequest;
