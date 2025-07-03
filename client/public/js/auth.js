// Firebase Auth functions
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Initialize Firebase with config
const firebaseConfig = {
    apiKey: "AIzaSyDI18GOdhGFiXsIrhvYVbKsfpAvhmuu29A",
    authDomain: "startup-connect-c5480.firebaseapp.com",
    projectId: "startup-connect-c5480",
    storageBucket: "startup-connect-c5480.firebasestorage.app",
    messagingSenderId: "136734721512",
    appId: "1:136734721512:web:d378e432f735f5a947105d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configure persistence
setPersistence(auth, browserLocalPersistence);

// Initialize Google provider with scopes
const provider = new GoogleAuthProvider();
provider.addScope('profile');
provider.addScope('email');
provider.setCustomParameters({
    prompt: 'select_account'
});

// Handle Google Sign In
async function handleGoogleSignIn() {
    console.log('Starting Google Sign In process...');
    try {
        // Clear any previous error messages
        const errorDiv = document.getElementById('error-message');
        errorDiv.classList.add('hidden');
        
        console.log('Opening Google popup...');
        const result = await signInWithPopup(auth, provider);
        console.log('Google sign in successful:', result);
        const user = result.user;
        
        // Get the ID token
        console.log('Getting ID token...');
        const idToken = await user.getIdToken(true); // Force refresh token
        
        // Send the token to your backend
        console.log('Sending token to backend...');
        const response = await fetch('/auth/google/callback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: idToken,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }),
            credentials: 'same-origin' // Include cookies in the request
        });

        if (!response.ok) {
            throw new Error(`Backend responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log('Backend response:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (data.redirect) {
            console.log('Redirecting to:', data.redirect);
            window.location.href = data.redirect;
        }
    } catch (error) {
        console.error('Error during Google sign in:', error);
        
        // Show error message to user
        const errorDiv = document.getElementById('error-message');
        const errorText = errorDiv.querySelector('.text-red-700');
        errorText.textContent = error.message || 'Failed to sign in with Google. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

// Export the function to make it available globally
window.handleGoogleSignIn = handleGoogleSignIn; 