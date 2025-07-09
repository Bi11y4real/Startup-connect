const { db } = require('../config/firebase');
const { collection, getDocs, query, where, Timestamp } = require('firebase/firestore');

const USERS_COLLECTION = 'users';
const PROJECTS_COLLECTION = 'projects';
const APPLICATIONS_COLLECTION = 'applications';
const Investment = require('./investment'); // Import the new Investment model

class Analytics {
    /**
     * Fetches the main dashboard stats for the analytics section.
     */
    static async getSummaryStats() {
        try {
            const usersSnapshot = await getDocs(collection(db, USERS_COLLECTION));
            const projectsSnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
            
            const pendingAppsQuery = query(collection(db, APPLICATIONS_COLLECTION), where('status', '==', 'pending'));
            const pendingAppsSnapshot = await getDocs(pendingAppsQuery);

            const totalUsers = usersSnapshot.size;
            const totalProjects = projectsSnapshot.size;
            const pendingApps = pendingAppsSnapshot.size;

            let totalFunding = 0;
            projectsSnapshot.forEach(doc => {
                totalFunding += doc.data().fundingRaised || 0;
            });

            return {
                totalUsers,
                totalProjects,
                totalFunding,
                pendingApps
            };
        } catch (error) {
            console.error('Error getting summary stats:', error);
            throw error;
        }
    }

    /**
     * Fetches user registration data for the last 30 days, formatted for Chart.js.
     */
    static async getUserRegistrations() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

            const q = query(collection(db, USERS_COLLECTION), where('createdAt', '>=', thirtyDaysAgoTimestamp));
            const querySnapshot = await getDocs(q);

            const registrations = {}; // { 'YYYY-MM-DD': count }
            querySnapshot.forEach(doc => {
                const user = doc.data();
                if (user.createdAt) {
                    const date = user.createdAt.toDate().toISOString().split('T')[0];
                    registrations[date] = (registrations[date] || 0) + 1;
                }
            });

            const labels = [];
            const data = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateString = d.toISOString().split('T')[0];
                labels.push(dateString);
                data.push(registrations[dateString] || 0);
            }

            return { labels, data };
        } catch (error) {
            console.error('Error getting user registrations:', error);
            throw error;
        }
    }

    /**
     * Fetches the distribution of projects by industry.
     */
    static async getProjectsByIndustry() {
        try {
            const projectsSnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
            const industryCounts = {};

            projectsSnapshot.forEach(doc => {
                const project = doc.data();
                const industry = project.industry || 'Other';
                industryCounts[industry] = (industryCounts[industry] || 0) + 1;
            });

            return {
                labels: Object.keys(industryCounts),
                data: Object.values(industryCounts)
            };
        } catch (error) {
            console.error('Error getting projects by industry:', error);
            throw error;
        }
    }

    /**
     * Fetches the distribution of applications by status.
     */
    static async getApplicationStatusDistribution() {
        try {
            const applicationsRef = collection(db, 'applications');
            const q = query(applicationsRef);
            const querySnapshot = await getDocs(q);

            const statusCounts = {
                pending: 0,
                accepted: 0,
                rejected: 0,
            };

            querySnapshot.forEach(doc => {
                const status = doc.data().status ? doc.data().status.toLowerCase() : 'pending';
                if (status in statusCounts) {
                    statusCounts[status]++;
                }
            });

            // The frontend expects the data in a specific order: ['Pending', 'Accepted', 'Rejected']
            return {
                data: [statusCounts.pending, statusCounts.accepted, statusCounts.rejected]
            };
        } catch (error) {
            console.error('Error getting application status distribution:', error);
            throw error;
        }
    }

    /**
     * Fetches funding activity for the last 30 days.
     */
    static async getFundingActivity() {
        try {
            const activity = await Investment.getFundingActivity(30);

            const labels = [];
            const data = [];
            
            // Create a map of dates for quick lookup
            const activityMap = new Map(activity.map(item => [item.date, item.amount]));

            // Generate labels for the last 30 days
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateString = d.toISOString().split('T')[0];
                labels.push(dateString);
                data.push(activityMap.get(dateString) || 0);
            }

            return { labels, data };
        } catch (error) {
            console.error('Error getting funding activity:', error);
            throw error;
        }
    }

    /**
     * Fetches all analytics data for a specific founder's dashboard.
     * @param {string} founderId - The ID of the founder.
     */
    static async getFounderAnalytics(founderId) {
        try {
            const [fundingOverview, applicationTrends] = await Promise.all([
                this.getFundingOverview(founderId),
                this.getApplicationTrends(founderId)
            ]);

            return { fundingOverview, applicationTrends };
        } catch (error) {
            console.error(`Error getting founder analytics for ${founderId}:`, error);
            throw error;
        }
    }

    /**
     * Fetches funding overview for all projects belonging to a founder.
     * @param {string} founderId - The ID of the founder.
     */
    static async getFundingOverview(founderId) {
        const projectsQuery = query(collection(db, PROJECTS_COLLECTION), where('founderId', '==', founderId));
        const projectsSnapshot = await getDocs(projectsQuery);

        const fundingData = projectsSnapshot.docs.map(doc => {
            const project = doc.data();
            const fundingRaised = project.fundingRaised || 0;
            const fundingGoal = project.fundingGoal || 1; // Avoid division by zero
            const percentage = Math.round((fundingRaised / fundingGoal) * 100);
            return {
                title: project.title,
                percentage
            };
        });

        return fundingData;
    }

    /**
     * Fetches application trends for all projects belonging to a founder.
     * @param {string} founderId - The ID of the founder.
     */

    static async getApplicationTrends(founderId) {
        const projectsQuery = query(collection(db, PROJECTS_COLLECTION), where('founderId', '==', founderId));
        const projectsSnapshot = await getDocs(projectsQuery);
        const projectIds = projectsSnapshot.docs.map(doc => doc.id);

        if (projectIds.length === 0) {
            return {
                thisWeek: 0,
                lastWeek: 0,
                thisMonth: 0,
                growthRate: 0
            };
        }

        const applicationsQuery = query(collection(db, APPLICATIONS_COLLECTION), where('projectId', 'in', projectIds));
        const applicationsSnapshot = await getDocs(applicationsQuery);

        const now = new Date();
        const today = now.getDay(); // 0=Sunday, 1=Monday, ...
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - today);
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfLastWeek = new Date(new Date().setDate(startOfWeek.getDate() - 7));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let thisWeekCount = 0;
        let lastWeekCount = 0;
        let thisMonthCount = 0;

        applicationsSnapshot.forEach(doc => {
            const app = doc.data();
            const createdAt = app.createdAt.toDate();

            if (createdAt >= startOfMonth) {
                thisMonthCount++;
            }
            if (createdAt >= startOfWeek) {
                thisWeekCount++;
            } else if (createdAt >= startOfLastWeek) {
                lastWeekCount++;
            }
        });

        const growthRate = lastWeekCount > 0 
            ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
            : (thisWeekCount > 0 ? 100 : 0);

        return {
            thisWeek: thisWeekCount,
            lastWeek: lastWeekCount,
            thisMonth: thisMonthCount,
            growthRate
        };
    }
}

module.exports = Analytics;
