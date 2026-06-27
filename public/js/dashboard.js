// Dashboard functionality

async function loadUserInfo() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Load user profile
        const response = await fetch(`/api/users/${user.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const userProfile = await response.json();
        document.getElementById('userInfo').innerHTML = `
            <div style="text-align: center;">
                <h3>${userProfile.fullName}</h3>
                <p>${userProfile.userType === 'worker' ? '👷 Worker' : '👤 Customer'}</p>
                <p>${userProfile.email}</p>
            </div>
        `;

        // Load appropriate dashboard
        if (userProfile.userType === 'worker') {
            loadWorkerDashboard(userProfile);
        } else {
            loadCustomerDashboard(userProfile);
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        window.location.href = 'login.html';
    }
}

async function loadWorkerDashboard(userProfile) {
    const token = localStorage.getItem('token');
    document.getElementById('workerDashboard').style.display = 'block';

    try {
        // Get worker profile
        const workerResponse = await fetch(`/api/workers/user/${userProfile._id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const worker = await workerResponse.json();

        // Update stats
        document.getElementById('workerRating').textContent = worker.rating.toFixed(1);
        document.getElementById('completedJobs').textContent = worker.completedJobs;
        document.getElementById('availabilityToggle').checked = worker.isAvailable;

        // Load opportunities
        const oppResponse = await fetch('/api/opportunities/worker/list', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const opportunities = await oppResponse.json();
        const oppList = document.getElementById('opportunitiesList');

        if (opportunities.length === 0) {
            oppList.innerHTML = '<p>No new opportunities at this time</p>';
        } else {
            oppList.innerHTML = opportunities.map(opp => `
                <div class="opportunity-card">
                    <h4>${opp.title}</h4>
                    <p>${opp.description}</p>
                    <p><strong>Skill Needed:</strong> ${opp.skillRequired}</p>
                    <p><strong>Location:</strong> ${opp.location}</p>
                    <p><strong>Budget:</strong> ${opp.budget || 'Not specified'}</p>
                    <p><strong>Priority:</strong> ${opp.priority}</p>
                    <p><strong>Posted by:</strong> ${opp.customerId.fullName}</p>
                    <button class="btn btn-primary" onclick="acceptOpportunity('${opp._id}')">Accept Job</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading worker dashboard:', error);
    }
}

async function loadCustomerDashboard(userProfile) {
    const token = localStorage.getItem('token');
    document.getElementById('customerDashboard').style.display = 'block';
    document.getElementById('createOpportunityLink').style.display = 'block';
    document.getElementById('opportunitiesLink').style.display = 'block';

    try {
        // Load customer's opportunities
        const response = await fetch('/api/opportunities', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const opportunities = await response.json();
        const myOpps = opportunities.filter(opp => opp.customerId._id === userProfile._id);

        const oppList = document.getElementById('myOpportunitiesList');

        if (myOpps.length === 0) {
            oppList.innerHTML = '<p>You haven\'t created any opportunities yet</p>';
        } else {
            oppList.innerHTML = myOpps.map(opp => `
                <div class="opportunity-card">
                    <h4>${opp.title}</h4>
                    <p>${opp.description}</p>
                    <p><strong>Skill Required:</strong> ${opp.skillRequired}</p>
                    <p><strong>Location:</strong> ${opp.location}</p>
                    <p><strong>Status:</strong> ${opp.status}</p>
                    <p><strong>Budget:</strong> ${opp.budget || 'Not specified'}</p>
                    ${opp.acceptedBy ? `<p><strong>Accepted by:</strong> Worker</p>` : '<p>Not yet accepted</p>'}
                    ${opp.status === 'in-progress' ? `<button class="btn btn-success" onclick="completeOpportunity('${opp._id}')">Mark Complete</button>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading customer dashboard:', error);
    }
}

async function acceptOpportunity(opportunityId) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/opportunities/${opportunityId}/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert('Opportunity accepted! Check your messages for customer details.');
            loadUserInfo();
        } else {
            alert('Error: ' + (data.message || 'Failed to accept opportunity'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error');
    }
}

async function completeOpportunity(opportunityId) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/opportunities/${opportunityId}/complete`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            alert('Opportunity marked as complete. Please rate the worker!');
            // Redirect to rating page (would implement in full app)
            loadUserInfo();
        } else {
            alert('Error: ' + (data.message || 'Failed to complete opportunity'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error');
    }
}

async function updateAvailability() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAvailable = document.getElementById('availabilityToggle').checked;

    try {
        // Get worker ID first
        const workerResponse = await fetch(`/api/workers/user/${user.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const worker = await workerResponse.json();

        const response = await fetch(`/api/workers/${worker._id}/availability`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isAvailable })
        });

        if (response.ok) {
            alert(`Availability updated to: ${isAvailable ? 'Available' : 'Unavailable'}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating availability');
    }
}

// Load on page load
window.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
});
