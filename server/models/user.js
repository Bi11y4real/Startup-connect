const { db } = require('../config/firebase');
const { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    query,
    where,
    getDocs
} = require('firebase/firestore');

const COLLECTION_NAME = 'users';

class User {
    static async create(userId, userData) {
        try {
            const userRef = doc(db, COLLECTION_NAME, userId);
            const user = {
                ...userData,
                id: userId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await setDoc(userRef, user);
            return user;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async getById(userId) {
        try {
            const userRef = doc(db, COLLECTION_NAME, userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                return { id: userSnap.id, ...userSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting user:', error);
            throw error;
        }
    }

    static async update(userId, updateData) {
        try {
            const userRef = doc(db, COLLECTION_NAME, userId);
            const userUpdate = {
                ...updateData,
                updatedAt: new Date()
            };
            await updateDoc(userRef, userUpdate);
            return await this.getById(userId);
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    static async setRole(userId, role) {
        try {
            const validRoles = ['founder', 'investor', 'collaborator'];
            if (!validRoles.includes(role)) {
                throw new Error('Invalid role');
            }

            return await this.update(userId, { role });
        } catch (error) {
            console.error('Error setting user role:', error);
            throw error;
        }
    }

    static async getByRole(role) {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('role', '==', role)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting users by role:', error);
            throw error;
        }
    }

    static async getProfile(userId) {
        try {
            const user = await this.getById(userId);
            if (!user) {
                return null;
            }

            let additionalData = {};
            switch (user.role) {
                case 'founder':
                    // Get founder's projects
                    const founderProjects = await db.collection('projects')
                        .where('founderId', '==', userId)
                        .get();
                    additionalData.projects = founderProjects.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    break;
                case 'investor':
                    // Get investor's investments
                    const investments = await db.collection('projects')
                        .where('investors', 'array-contains', { userId })
                        .get();
                    additionalData.investments = investments.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    break;
                case 'collaborator':
                    // Get collaborator's projects
                    const collaborations = await db.collection('projects')
                        .where('collaborators', 'array-contains', { userId })
                        .get();
                    additionalData.collaborations = collaborations.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    break;
            }

            return {
                ...user,
                ...additionalData
            };
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }
}

module.exports = User; 