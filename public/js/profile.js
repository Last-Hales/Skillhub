// Profile page functionality

let currentWorkerId = null;

async function loadProfile() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`/api/users/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const userProfile = await response.json();

        // Fill basic fields
        document.getElementById('fullName').value = userProfile.fullName;
        document.getElementById('email').value = userProfile.email;
        document.getElementById('phoneNumber').value = userProfile.phoneNumber;
        document.getElementById('address').value = userProfile.address;
        populateCountries('country', userProfile.country);
        populateStates('country', 'state', 'stateText', userProfile.state);
        document.getElementById('country').addEventListener('change', () => {
            populateStates('country', 'state', 'stateText');
        });

        // Load worker-specific data if worker
        if (userProfile.userType === 'worker') {
            const workerResponse = await fetch(`/api/workers/user/${userProfile._id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const worker = await workerResponse.json();
            currentWorkerId = worker._id;

            document.getElementById('workerProfileFields').style.display = 'block';
            document.getElementById('skills').value = worker.skills.join(', ');
            document.getElementById('services').value = worker.services;
            document.getElementById('handwork').value = worker.handwork;
            document.getElementById('yearsOfExperience').value = worker.yearsOfExperience || '';
            document.getElementById('bio').value = worker.bio || '';
            document.getElementById('workerRating').textContent = worker.rating.toFixed(1);
            document.getElementById('completedJobsCount').textContent = worker.completedJobs;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        window.location.href = 'login.html';
    }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    const userType = JSON.parse(localStorage.getItem('user')).userType;

    const userData = {
        fullName: document.getElementById('fullName').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        address: document.getElementById('address').value,
        country: document.getElementById('country').value,
        state: getStateInputValue('state', 'stateText')
    };

    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) throw new Error('Failed to update profile');

        // If worker, update worker profile
        if (userType === 'worker' && currentWorkerId) {
            const workerData = {
                skills: document.getElementById('skills').value.split(',').map(s => s.trim()),
                services: document.getElementById('services').value,
                handwork: document.getElementById('handwork').value,
                yearsOfExperience: parseInt(document.getElementById('yearsOfExperience').value) || 0,
                bio: document.getElementById('bio').value
            };

            const workerResponse = await fetch(`/api/workers/${currentWorkerId}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(workerData)
            });

            if (!workerResponse.ok) throw new Error('Failed to update worker profile');
        }

        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating profile');
    }
});

// Load profile on page load
window.addEventListener('DOMContentLoaded', () => {
    loadProfile();
});
