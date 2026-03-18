import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push, remove } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ====== FIREBASE CONFIGURATION ======
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Replace if restricted
    authDomain: "mini-project-b629e.firebaseapp.com",
    databaseURL: "https://mini-project-b629e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mini-project-b629e",
    storageBucket: "mini-project-b629e.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Global Authentication Protection
function checkAuth(allowedRoles) {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userType');

    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return false;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        alert("Unauthorized access! Redirecting...");
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

window.logout = function() {
    localStorage.setItem('isLoggedIn', 'false');
    localStorage.removeItem('userType');
    window.location.href = 'login.html';
};

export { database, ref, onValue, set, update, push, remove, checkAuth };
