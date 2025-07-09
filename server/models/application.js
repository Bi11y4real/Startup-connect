const { db } = require('../config/firebase');
const {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} = require('firebase/firestore');
const User = require('./user');
const Project = require('./project');

const COLLECTION_NAME = 'applications';

class Application {
    static async create(projectId, userId, role) {
        try {
            const applicationRef = doc(collection(db, COLLECTION_NAME));
            const applicationId = applicationRef.id;

            const applicationData = {
                id: applicationId,
                projectId,
                userId,
                role,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await setDoc(applicationRef, applicationData);
            return applicationId;
        } catch (error) {
            console.error('Error creating application:', error.message);
            throw error;
        }
    }

    static async getAll(status = null) {
        try {
            let q;
            if (status && status !== 'all') {
                q = query(
                    collection(db, COLLECTION_NAME),
                    where('status', '==', status),
                    orderBy('createdAt', 'desc')
                );
            } else {
                q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
            }
            const querySnapshot = await getDocs(q);

            const applications = await Promise.all(querySnapshot.docs.map(async (doc) => {
                const app = doc.data();
                let projectName = 'Unknown Project';
                let applicantName = 'Unknown Applicant';

                // Fetch project name
                try {
                    if (app.projectId) {
                        const project = await Project.getById(app.projectId);
                        if (project) {
                            projectName = project.title;
                        }
                    }
                } catch (projectError) {
                    console.error(`Failed to fetch project ${app.projectId} for application ${doc.id}`, projectError);
                }

                // Fetch applicant name
                try {
                    if (app.userId) {
                        const applicant = await User.getById(app.userId);
                        if (applicant) {
                            applicantName = applicant.name;
                        }
                    }
                } catch (userError) {
                    console.error(`Failed to fetch user ${app.userId} for application ${doc.id}`, userError);
                }
                
                // Convert timestamps
                if (app.createdAt) {
                    app.createdAt = app.createdAt.toDate();
                }
                if (app.updatedAt) {
                    app.updatedAt = app.updatedAt.toDate();
                }

                return {
                    id: doc.id,
                    ...app,
                    projectName,
                    applicantName,
                };
            }));

            return applications;
        } catch (error) {
            console.error('Error getting all applications:', error);
            throw error;
        }
    }

    static async getApplicationsByUserId(userId) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);

            const applications = await Promise.all(querySnapshot.docs.map(async (doc) => {
                const app = doc.data();
                let projectName = 'Unknown Project';

                // Fetch project name
                try {
                    if (app.projectId) {
                        const project = await Project.getById(app.projectId);
                        if (project) {
                            projectName = project.title;
                        }
                    }
                } catch (projectError) {
                    console.error(`Failed to fetch project ${app.projectId} for application ${doc.id}`, projectError);
                }

                // Convert timestamps
                if (app.createdAt) {
                    app.createdAt = app.createdAt.toDate();
                }
                if (app.updatedAt) {
                    app.updatedAt = app.updatedAt.toDate();
                }

                return {
                    id: doc.id,
                    ...app,
                    projectName,
                };
            }));

            return applications;
        } catch (error) {
            console.error('Error getting applications by user ID:', error);
            throw error;
        }
    }

    static async updateStatus(applicationId, status) {
        try {
            const applicationRef = doc(db, COLLECTION_NAME, applicationId);
            await updateDoc(applicationRef, {
                status,
                updatedAt: serverTimestamp(),
            });
            return true;
        } catch (error) {
            console.error('Error updating application status:', error);
            throw error;
        }
    }
}

module.exports = Application;
