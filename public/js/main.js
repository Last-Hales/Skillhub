// Main page functionality

async function loadWorkers() {
    try {
        const response = await fetch('/api/workers');
        const workers = await response.json();
        displayWorkers(workers);
    } catch (error) {
        console.error('Error loading workers:', error);
        document.getElementById('workersGrid').innerHTML = '<p>Error loading workers</p>';
    }
}

function displayWorkers(workers) {
    const grid = document.getElementById('workersGrid');
    
    if (workers.length === 0) {
        grid.innerHTML = '<p>No workers available</p>';
        return;
    }

    grid.innerHTML = workers.map(worker => `
        <div class="worker-card">
            <div class="worker-header">
                <h3>${worker.userId.fullName}</h3>
                <div class="worker-rating">⭐ ${worker.rating.toFixed(1)}</div>
            </div>
            <p><strong>Skills:</strong> ${worker.skills.join(', ')}</p>
            <p><strong>Services:</strong> ${worker.services}</p>
            <p><strong>Specialization:</strong> ${worker.handwork}</p>
            <p><strong>Location:</strong> ${worker.userId.address}, ${worker.userId.state}, ${worker.userId.country}</p>
            <p><strong>Experience:</strong> ${worker.yearsOfExperience || 'Not specified'} years</p>
            <p><strong>Completed Jobs:</strong> ${worker.completedJobs}</p>
            <p><strong>Status:</strong> ${worker.isAvailable ? '✅ Available' : '❌ Unavailable'}</p>
            <button class="btn btn-primary" onclick="viewWorkerProfile('${worker._id}')">View Profile</button>
        </div>
    `).join('');
}

async function searchWorkers() {
    const skill = document.getElementById('searchSkill').value;
    const location = document.getElementById('searchLocation').value;

    try {
        let url = '/api/workers/search?';
        if (skill) url += `skill=${encodeURIComponent(skill)}&`;
        if (location) url += `location=${encodeURIComponent(location)}&`;

        const response = await fetch(url);
        const workers = await response.json();
        displayWorkers(workers);
    } catch (error) {
        console.error('Error searching workers:', error);
        alert('Error searching workers');
    }
}

function viewWorkerProfile(workerId) {
    // In a full implementation, navigate to a worker detail page
    alert('Viewing worker profile: ' + workerId);
}

// Load workers on page load
window.addEventListener('DOMContentLoaded', () => {
    loadWorkers();
});
