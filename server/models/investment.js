const { db } = require('../config/firebase');
const { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, Timestamp } = require('firebase/firestore');

const COLLECTION_NAME = 'investments';

class Investment {
    /**
     * Creates a new investment record in the centralized investments collection.
     * @param {string} projectId - The ID of the project being invested in.
     * @param {string} userId - The ID of the user making the investment.
     * @param {number} amount - The amount invested.
     * @returns {Promise<string>} The ID of the new investment document.
     */
    static async create(projectId, userId, amount) {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                projectId,
                userId,
                amount,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating investment record:', error);
            throw error;
        }
    }

    /**
     * Fetches funding activity for a specified number of days for analytics graphs.
     * @param {number} days - The number of past days to fetch activity for.
     * @returns {Promise<Array<{date: string, amount: number}>>} An array of objects with date and total amount.
     */
    static async getFundingActivity(days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const q = query(
                collection(db, COLLECTION_NAME),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                orderBy('createdAt', 'asc')
            );

            const querySnapshot = await getDocs(q);

            const activityByDate = {};

            querySnapshot.docs.forEach(doc => {
                const investment = doc.data();
                const date = investment.createdAt.toDate().toISOString().split('T')[0]; // Group by day (YYYY-MM-DD)
                if (!activityByDate[date]) {
                    activityByDate[date] = 0;
                }
                activityByDate[date] += investment.amount;
            });

            // Convert to array of objects for charting
            const formattedActivity = Object.keys(activityByDate).map(date => ({
                date,
                amount: activityByDate[date]
            }));

            return formattedActivity;
        } catch (error) {
            console.error('Error fetching funding activity:', error);
            throw error;
        }
    }
}

module.exports = Investment;
