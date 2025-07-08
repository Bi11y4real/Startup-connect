const { db } = require('../config/firebase');
const { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    query,
    where,
    getDocs,
    deleteDoc
} = require('firebase/firestore');

const COLLECTION_NAME = 'users';

class User {
    static async create(userId, userData) {
        try {
            const userRef = doc(db, COLLECTION_NAME, userId);
            const user = {
                ...userData,
                id: userId,
                status: 'active', // Default status for new users
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

    static async delete(userId) {
        try {
            const userRef = doc(db, COLLECTION_NAME, userId);
            await deleteDoc(userRef);
            return true;
        } catch (error) {
            console.error('Error deleting user:', error);
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

    static async getTotalCount() {
        try {
            const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
            return querySnapshot.size;
        } catch (error) {
            console.error('Error getting total user count:', error);
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
            const projectsRef = collection(db, 'projects');
            let q;
            let querySnapshot;

            switch (user.role) {
                case 'founder':
                    q = query(projectsRef, where('founderId', '==', userId));
                    querySnapshot = await getDocs(q);
                    additionalData.projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    break;
                case 'investor':
                    // Note: Firestore 'array-contains' is for single values. For multiple, you'd use 'in' queries.
                    // This assumes an investor is linked to projects one by one in an array.
                    q = query(projectsRef, where('investors', 'array-contains', userId));
                    querySnapshot = await getDocs(q);
                    additionalData.investments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    break;
                case 'collaborator':
                    q = query(projectsRef, where('collaborators', 'array-contains', userId));
                    querySnapshot = await getDocs(q);
                    additionalData.collaborations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    static async getAll(filters = {}) {
        try {
            const { searchTerm, role, status } = filters;
            
            let usersQuery = collection(db, COLLECTION_NAME);
            const queryConstraints = [];

            if (role) {
                queryConstraints.push(where('role', '==', role));
            }
            if (status) {
                queryConstraints.push(where('status', '==', status));
            }

            if (queryConstraints.length > 0) {
                usersQuery = query(usersQuery, ...queryConstraints);
            }

            const querySnapshot = await getDocs(usersQuery);
            let users = querySnapshot.docs.map(doc => {
                const data = doc.data();
                // Convert Firestore Timestamps to JS Date objects
                if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
                    data.updatedAt = data.updatedAt.toDate();
                }
                return { id: doc.id, ...data };
            });

            // Firestore doesn't support native text search across multiple fields like SQL LIKE.
            // We fetch based on indexed fields (role, status) first, then filter by search term.
            if (searchTerm) {
                const lowercasedTerm = searchTerm.toLowerCase();
                users = users.filter(user => 
                    (user.name && user.name.toLowerCase().includes(lowercasedTerm)) ||
                    (user.email && user.email.toLowerCase().includes(lowercasedTerm))
                );
            }

            return users;
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }
}

module.exports = User; 