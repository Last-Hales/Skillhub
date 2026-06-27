async function loadAdminPanel() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || user.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch('/api/users/recent', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to load recent users');
        }

        const users = await response.json();
        renderAdminSummary(users);
        renderRecentUsers(users);
    } catch (error) {
        console.error('Error loading admin panel:', error);
        document.getElementById('recentUsersContainer').innerHTML = `<p>Error loading admin panel: ${error.message}</p>`;
        document.getElementById('adminSummary').innerHTML = '';
    }
}

function renderAdminSummary(users) {
    const workers = users.filter(u => u.userType === 'worker');
    const customers = users.filter(u => u.userType === 'customer');
    const bannedWorkers = workers.filter(w => w.isBanned);

    document.getElementById('adminSummary').innerHTML = `
        <div class="admin-stats">
            <div class="admin-card">
                <h4>Total Users</h4>
                <p>${users.length}</p>
            </div>
            <div class="admin-card">
                <h4>Workers</h4>
                <p>${workers.length}</p>
            </div>
            <div class="admin-card">
                <h4>Customers</h4>
                <p>${customers.length}</p>
            </div>
            <div class="admin-card">
                <h4>Banned Workers</h4>
                <p>${bannedWorkers.length}</p>
            </div>
        </div>
    `;
}

function renderRecentUsers(users) {
    const container = document.getElementById('recentUsersContainer');

    if (!users.length) {
        container.innerHTML = '<p>No recent signups available.</p>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="admin-user-card ${user.isBanned ? 'banned' : ''}">
            <div class="admin-user-header">
                <div>
                    <h4>${user.fullName || 'Unnamed User'}</h4>
                    <p>${user.email}</p>
                </div>
                <span class="user-type ${user.userType}">${user.userType}</span>
            </div>
            <p><strong>Country:</strong> ${user.country || 'N/A'} | <strong>State:</strong> ${user.state || 'N/A'}</p>
            <p><strong>Created:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
            <p><strong>Status:</strong> ${user.isBanned ? 'Banned' : 'Active'}</p>
            <div class="admin-actions">
                ${user.userType === 'worker' ? `<button class="btn ${user.isBanned ? 'btn-secondary' : 'btn-danger'}" onclick="toggleBan('${user._id}', ${!user.isBanned})">${user.isBanned ? 'Unban Worker' : 'Ban Worker'}</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function toggleBan(userId, ban) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/users/${userId}/ban`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ban })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to update ban status');
        }

        alert(data.message);
        loadAdminPanel();
    } catch (error) {
        console.error('Error updating ban status:', error);
        alert('Error: ' + error.message);
    }
}

window.addEventListener('DOMContentLoaded', loadAdminPanel);
