// Authentication functions

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function goToSignup(userType) {
    window.location.href = `signup.html`;
}

function goToCreateOpportunity() {
    window.location.href = 'create-opportunity.html';
}

// Check if user is logged in and update navbar
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userMenu = document.getElementById('userMenu');
    const navLinks = document.getElementById('navLinks');

    if (token && user.id) {
        // User is logged in
        if (userMenu) {
            userMenu.style.display = 'block';
        }
        // Hide login/signup links
        const links = navLinks?.querySelectorAll('a');
        links?.forEach(link => {
            if (link.textContent.includes('Login') || link.textContent.includes('Sign Up')) {
                link.style.display = 'none';
            }
        });

        // Add admin panel link for admins
        if (user.role === 'admin') {
            const existingAdminLink = Array.from(navLinks.children).find(child => child.textContent === 'Admin Panel');
            if (!existingAdminLink) {
                const adminLink = document.createElement('a');
                adminLink.href = 'admin.html';
                adminLink.textContent = 'Admin Panel';
                navLinks.appendChild(adminLink);
            }
        }
    } else {
        // User is not logged in
        if (userMenu) {
            userMenu.style.display = 'none';
        }
    }
});

// Verify token validity
async function verifyToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        return false;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}
