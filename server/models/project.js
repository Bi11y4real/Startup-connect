const { db } = require('../config/firebase');
const Investment = require('./investment'); // Import the new Investment model
const { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} = require('firebase/firestore');
const fs = require('fs').promises;
const path = require('path');
const User = require('./user');

const COLLECTION_NAME = 'projects';
const PROJECTS_PER_PAGE = 12;
const UPLOAD_PATH = path.join(__dirname, '../../client/public/uploads/projects');

class Project {
    static async create(userId, projectData, imageFile = null) {
        try {
            // Create a new project document with auto-generated ID
            const projectRef = doc(collection(db, COLLECTION_NAME));
            const projectId = projectRef.id;

            // Handle image upload if provided
            let imageUrl = null;
            if (imageFile) {
                try {
                    // Generate a unique filename using timestamp and original extension
                    const fileExtension = imageFile.originalname.split('.').pop();
                    const uniqueFilename = `${Date.now()}-${projectId}.${fileExtension}`;
                    const filePath = path.join(UPLOAD_PATH, uniqueFilename);

                    // Save the file
                    await fs.writeFile(filePath, imageFile.buffer);
                    imageUrl = `/uploads/projects/${uniqueFilename}`;
                } catch (uploadError) {
                    console.error('Warning: Image upload failed:', uploadError.message);
                    // Continue with project creation even if image upload fails
                }
            }

            // Prepare project data
            const project = {
                ...projectData,
                id: projectId,
                founderId: userId,
                imageUrl: imageUrl,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'active', // e.g., 'idea', 'active', 'archived'
                fundingRaised: 0,
                fundingGoal: projectData.fundingGoal || 0,
                collaborators: [],
                investors: [],
                investorIds: [], // For querying
                tags: projectData.tags || [], // e.g., ['FinTech', 'AI', 'MVP']
                openRoles: projectData.openRoles || [], // e.g., ['Frontend Developer', 'Marketing Manager']
                likes: 0,
                views: 0,
                applicationsCount: 0
            };

            // Save to Firestore
            await setDoc(projectRef, project);
            return projectId;
        } catch (error) {
            console.error('Error creating project:', error.message);
            throw error;
        }
    }

    static async incrementView(projectId) {
        try {
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            const projectSnap = await getDoc(projectRef);

            if (projectSnap.exists()) {
                const currentViews = projectSnap.data().views || 0;
                await updateDoc(projectRef, {
                    views: currentViews + 1
                });
            }
        } catch (error) {
            console.error('Error incrementing project view:', error);
            // Don't throw, as this is a non-critical background operation
        }
    }

    static async getById(projectId) {
        try {
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            const projectSnap = await getDoc(projectRef);
            
            if (projectSnap.exists()) {
                const projectData = projectSnap.data();
                // Convert Firestore Timestamps to Dates
                if (projectData.createdAt) {
                    projectData.createdAt = projectData.createdAt.toDate();
                }
                if (projectData.updatedAt) {
                    projectData.updatedAt = projectData.updatedAt.toDate();
                }
                return { id: projectSnap.id, ...projectData };
            }
            return null;
        } catch (error) {
            console.error('Error getting project:', error);
            throw error;
        }
    }

    static async update(projectId, updateData, imageFile = null) {
        try {
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            
            // Handle image upload if provided
            if (imageFile) {
                try {
                    // Delete old image if it exists
                    const oldProject = await this.getById(projectId);
                    if (oldProject && oldProject.imageUrl) {
                        const oldImagePath = path.join('public', oldProject.imageUrl);
                        await fs.unlink(oldImagePath).catch(() => {});
                    }

                    // Save new image
                    const fileExtension = imageFile.originalname.split('.').pop();
                    const uniqueFilename = `${Date.now()}-${projectId}.${fileExtension}`;
                    const filePath = path.join(UPLOAD_PATH, uniqueFilename);
                    
                    await fs.writeFile(filePath, imageFile.buffer);
                    updateData.imageUrl = `/uploads/projects/${uniqueFilename}`;
                } catch (uploadError) {
                    console.error('Warning: Image update failed:', uploadError.message);
                }
            }

            // Update project data
            const projectUpdate = {
                ...updateData,
                updatedAt: serverTimestamp()
            };

            await updateDoc(projectRef, projectUpdate);
            return await this.getById(projectId);
        } catch (error) {
            console.error('Error updating project:', error.message);
            throw error;
        }
    }

    static async delete(projectId) {
        try {
            // Delete project image if it exists
            const project = await this.getById(projectId);
            if (project && project.imageUrl) {
                const imagePath = path.join('public', project.imageUrl);
                await fs.unlink(imagePath).catch(() => {});
            }

            // Delete project document
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            await deleteDoc(projectRef);
            return true;
        } catch (error) {
            console.error('Error deleting project:', error.message);
            throw error;
        }
    }

    static async getByFounderId(founderId) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('founderId', '==', founderId),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore Timestamps to Dates
                if (data.createdAt) {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.updatedAt) {
                    data.updatedAt = data.updatedAt.toDate();
                }
                return { id: doc.id, ...data };
            });
        } catch (error) {
            console.error('Error getting founder projects:', error);
            throw error;
        }
    }

    static async getAll() {
        try {
            const projectsRef = collection(db, COLLECTION_NAME);
            const q = query(projectsRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);

            // Use Promise.all to fetch all projects and their founders concurrently
            const projects = await Promise.all(querySnapshot.docs.map(async (doc) => {
                const data = doc.data();

                // Fetch founder details
                let founder = null;
                if (data.founderId) {
                    try {
                        founder = await User.getById(data.founderId);
                    } catch (userError) {
                        console.error(`Failed to fetch founder with ID: ${data.founderId}`, userError);
                        // Assign a default/placeholder founder object to prevent render errors
                        founder = { name: 'Unknown Founder', email: '' };
                    }
                }

                // Convert Firestore Timestamps to Dates
                if (data.createdAt) {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.updatedAt) {
                    data.updatedAt = data.updatedAt.toDate();
                }
                // Convert investor timestamps
                if (data.investors && Array.isArray(data.investors)) {
                    data.investors = data.investors.map(investor => {
                        if (investor.investedAt) {
                            investor.investedAt = investor.investedAt.toDate();
                        }
                        if (investor.updatedAt) {
                            investor.updatedAt = investor.updatedAt.toDate();
                        }
                        return investor;
                    });
                }

                return { 
                    id: doc.id, 
                    ...data, 
                    founder // Embed the founder object
                };
            }));

            return projects;
        } catch (error) {
            console.error('Error getting all projects:', error);
            throw error;
        }
    }

    static async search({ 
        industry = null,
        status = null,
        fundingMin = null,
        fundingMax = null,
        lastDoc = null,
        searchTerm = null
    }) {
        try {
            let q = collection(db, COLLECTION_NAME);
            const conditions = [];

            // Add filters
            if (industry) {
                conditions.push(where('industry', '==', industry));
            }
            if (status) {
                conditions.push(where('status', '==', status));
            }
            if (fundingMin !== null) {
                conditions.push(where('fundingGoal', '>=', fundingMin));
            }
            if (fundingMax !== null) {
                conditions.push(where('fundingGoal', '<=', fundingMax));
            }

            // Add search term filter
            if (searchTerm) {
                conditions.push(
                    where('title', '>=', searchTerm),
                    where('title', '<=', searchTerm + '\uf8ff')
                );
            }

            // Add pagination
            if (lastDoc) {
                q = query(q, startAfter(lastDoc));
            }

            // Apply all conditions
            if (conditions.length > 0) {
                q = query(q, ...conditions);
            }

            // Add ordering and limit
            q = query(q, orderBy('createdAt', 'desc'), limit(PROJECTS_PER_PAGE));

            const querySnapshot = await getDocs(q);
            const projects = querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore Timestamps to Dates
                if (data.createdAt) {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.updatedAt) {
                    data.updatedAt = data.updatedAt.toDate();
                }
                return { id: doc.id, ...data };
            });

            // Get last document for pagination
            const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

            return { projects, lastVisible };
        } catch (error) {
            console.error('Error searching projects:', error);
            throw error;
        }
    }

    static async addCollaborator(projectId, collaboratorId, role) {
        try {
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            const projectDoc = await getDoc(projectRef);
            
            if (!projectDoc.exists()) {
                throw new Error('Project not found');
            }

            const projectData = projectDoc.data();
            const collaborators = projectData.collaborators || [];

            // Check if collaborator already exists
            const existingCollaborator = collaborators.find(c => c.userId === collaboratorId);
            if (existingCollaborator) {
                throw new Error('User is already a collaborator');
            }

            // Add new collaborator with regular timestamp instead of serverTimestamp
            collaborators.push({
                userId: collaboratorId,
                role: role,
                joinedAt: new Date().toISOString() // Use ISO string format for consistency
            });

            // Update project with new collaborator and server timestamp for updatedAt
            await updateDoc(projectRef, {
                collaborators: collaborators,
                updatedAt: serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Error adding collaborator:', error);
            throw error;
        }
    }

    static async addInvestment(projectId, userId, amount) {
        try {
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            const project = await this.getById(projectId);
            
            if (!project) {
                throw new Error('Project not found');
            }

            const investors = project.investors || [];
            const existingInvestment = investors.find(i => i.userId === userId);

            if (existingInvestment) {
                existingInvestment.amount += amount;
                existingInvestment.updatedAt = new Date();
            } else {
                investors.push({
                    userId,
                    amount,
                    investedAt: new Date(),
                    updatedAt: new Date()
                });
            }

            await updateDoc(projectRef, {
                investors,
                investorIds: investors.map(i => i.userId),
                fundingRaised: (project.fundingRaised || 0) + amount,
                updatedAt: serverTimestamp()
            });

            // Create a record in the centralized investments collection for analytics
            await Investment.create(projectId, userId, amount);

            return true;
        } catch (error) {
            console.error('Error adding investment:', error);
            throw error;
        }
    }

    static async getStats(userId) {
        try {
            const projects = await this.getByFounderId(userId);
            
            const stats = {
                activeProjects: 0,
                totalFunding: 0,
                totalFundingGoal: 0,
                totalCollaborators: 0,
                totalApplications: 0,
                totalViews: 0,
            };

            projects.forEach(project => {
                if (project.status === 'active') {
                    stats.activeProjects++;
                }
                stats.totalFunding += project.fundingRaised || 0;
                stats.totalFundingGoal += project.fundingGoal || 0;
                stats.totalCollaborators += (project.collaborators || []).length;
                stats.totalApplications += project.applicationsCount || 0;
                stats.totalViews += project.views || 0;
            });

            return stats;
        } catch (error) {
            console.error('Error getting founder stats:', error);
            throw error;
        }
    }

    static async getByStatus(userId, status = null) {
        try {
            let conditions = [where('founderId', '==', userId)];
            
            if (status) {
                conditions.push(where('status', '==', status));
            }
            
            conditions.push(orderBy('createdAt', 'desc'));

            const q = query(collection(db, COLLECTION_NAME), ...conditions);
            const querySnapshot = await getDocs(q);
            
            return querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore Timestamps to Dates
                if (data.createdAt) {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.updatedAt) {
                    data.updatedAt = data.updatedAt.toDate();
                }
                return { id: doc.id, ...data };
            });
        } catch (error) {
            console.error('Error getting projects by status:', error);
            throw error;
        }
    }

    static async getPlatformStats() {
        try {
            const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
            
            let stats = {
                totalProjects: querySnapshot.size,
                totalInvestment: 0,
                totalCollaborators: 0
            };

            querySnapshot.forEach(doc => {
                const project = doc.data();
                stats.totalInvestment += project.fundingRaised || 0;
                stats.totalCollaborators += (project.collaborators || []).length;
            });

            return stats;
        } catch (error) {
            console.error('Error getting platform stats:', error);
            throw error;
        }
    }

    static async updateStatus(projectId, status) {
        try {
            const projectRef = doc(db, COLLECTION_NAME, projectId);
            await updateDoc(projectRef, {
                status: status,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error updating project status:', error);
            throw error;
        }
    }

    static async getAvailableForInvestment() {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            
            // Filter projects that haven't reached their funding goal
            const projects = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data };
            }).filter(project => {
                const fundingRaised = project.fundingRaised || 0;
                const fundingGoal = project.fundingGoal || 0;
                return fundingRaised < fundingGoal;
            });

            return projects;
        } catch (error) {
            console.error('Error getting investment opportunities:', error);
            throw error;
        }
    }

    static async getPortfolioByInvestorId(investorId) {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('investorIds', 'array-contains', investorId));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting portfolio by investor ID:', error);
            throw error;
        }
    }

    static async getSectorAllocation(investorId) {
        try {
            const portfolio = await this.getPortfolioByInvestorId(investorId);
            if (portfolio.length === 0) {
                return [];
            }

            const sectorTotals = {};
            let grandTotal = 0;

            portfolio.forEach(project => {
                const investment = project.investors.find(inv => inv.userId === investorId);
                if (investment && project.sector) {
                    const amount = investment.amount;
                    sectorTotals[project.sector] = (sectorTotals[project.sector] || 0) + amount;
                    grandTotal += amount;
                }
            });

            if (grandTotal === 0) {
                return [];
            }

            const allocation = Object.entries(sectorTotals).map(([sector, total]) => ({
                sector,
                percentage: Math.round((total / grandTotal) * 100)
            }));

            return allocation.sort((a, b) => b.percentage - a.percentage);
        } catch (error) {
            console.error('Error getting sector allocation:', error);
            throw error;
        }
    }

    static async getInvestorStats(investorId) {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('investorIds', 'array-contains', investorId));
            const querySnapshot = await getDocs(q);

            let totalInvested = 0;
            let activeDeals = 0;

            querySnapshot.forEach(doc => {
                const project = doc.data();
                const investment = project.investors.find(inv => inv.userId === investorId);
                if (investment) {
                    totalInvested += investment.amount;
                }
                if (project.status === 'active') {
                    activeDeals++;
                }
            });

            return {
                totalInvested,
                activeDeals,
                totalDeals: querySnapshot.size
            };
        } catch (error) {
            console.error('Error getting investor stats:', error);
            throw error;
        }
    }

    static async getCollaboratorStats(collaboratorId) {
        try {
            const projects = await this.getProjectsByCollaboratorId(collaboratorId);
            
            const activeProjects = projects.filter(p => p.status === 'active').length;
            const totalProjects = projects.length;

            // In the future, we can add tasks assigned, etc.
            return {
                activeProjects,
                totalProjects
            };
        } catch (error) {
            console.error('Error getting collaborator stats:', error);
            throw error;
        }
    }

    static async getProjectsByCollaboratorId(collaboratorId) {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('collaborators', 'array-contains', collaboratorId));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting projects by collaborator ID:', error);
            throw error;
        }
    }

    static async getAvailableForCollaboration() {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            
            // Filter projects that are still accepting collaborators
            const projects = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data };
            }).filter(project => {
                const currentCollaborators = project.collaborators?.length || 0;
                const maxCollaborators = project.maxCollaborators || 5; // Default max of 5
                return currentCollaborators < maxCollaborators;
            });

            return projects;
        } catch (error) {
            console.error('Error getting collaboration opportunities:', error);
            throw error;
        }
    }
}

module.exports = Project; 