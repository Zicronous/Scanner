// ==================== DATABASE SETUP ====================
let materials = [];
let selectedMaterial = null;
let scanBuffer = "";
let lastKeyTime = 0;
let html5QrcodeScanner = null;
let isScanning = false;
let activities = [];
let scanMode = 'add'; 

function escapeHtmlAttr(str) {
    return str.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}
// ==================== WEEKLY REPORT FUNCTIONS ====================

// Show weekly report modal
function showWeeklyReport() {
    // Set default dates to last 7 days
    setLast7Days();
    document.getElementById('reportModal').style.display = 'flex';
}

// Close report modal
function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
    document.getElementById('reportResults').style.display = 'none';
}

// Set date range to last 7 days
function setLast7Days() {
    let end = new Date();
    let start = new Date();
    start.setDate(start.getDate() - 7);
    
    document.getElementById('reportEndDate').value = end.toISOString().split('T')[0];
    document.getElementById('reportStartDate').value = start.toISOString().split('T')[0];
}

// Set date range to this week (Monday - Sunday)
function setThisWeek() {
    let now = new Date();
    let dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday (start of week)
    let monday = new Date(now);
    let diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Sunday
    monday.setDate(now.getDate() - diff);
    
    // Calculate Sunday (end of week)
    let sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    document.getElementById('reportStartDate').value = monday.toISOString().split('T')[0];
    document.getElementById('reportEndDate').value = sunday.toISOString().split('T')[0];
}

// Set date range to last week
function setLastWeek() {
    let now = new Date();
    let dayOfWeek = now.getDay();
    
    // Calculate last Monday
    let lastMonday = new Date(now);
    let diff = dayOfWeek === 0 ? 13 : dayOfWeek + 6; // Adjust for Sunday
    lastMonday.setDate(now.getDate() - diff);
    
    // Calculate last Sunday
    let lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    
    document.getElementById('reportStartDate').value = lastMonday.toISOString().split('T')[0];
    document.getElementById('reportEndDate').value = lastSunday.toISOString().split('T')[0];
}

// Generate weekly report
function generateWeeklyReport() {
    let startDate = new Date(document.getElementById('reportStartDate').value);
    let endDate = new Date(document.getElementById('reportEndDate').value);
    endDate.setHours(23, 59, 59); // Include the entire end day
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    // Filter activities within date range
    let reportActivities = activities.filter(a => {
        if (!a || !a.timestamp) return false;
        let activityDate = new Date(a.timestamp);
        return activityDate >= startDate && activityDate <= endDate;
    });
    
    // Sort by date (newest first)
    reportActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Generate summary
    let summary = {
        totalReceives: reportActivities.filter(a => a.action === 'RECEIVE').length,
        totalIssues: reportActivities.filter(a => a.action === 'ISSUE').length,
        totalCounts: reportActivities.filter(a => a.action === 'COUNT').length,
        totalAdds: reportActivities.filter(a => a.action === 'ADD').length,
        totalDeletes: reportActivities.filter(a => a.action === 'DELETE').length,
        
        totalReceiveQty: reportActivities
            .filter(a => a.action === 'RECEIVE')
            .reduce((sum, a) => sum + (a.quantity || 0), 0),
        totalIssueQty: reportActivities
            .filter(a => a.action === 'ISSUE')
            .reduce((sum, a) => sum + (a.quantity || 0), 0),
    };
    
    // Display summary
    let summaryHtml = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div style="background: #28a745; color: white; padding: 10px; border-radius: 5px; text-align: center;">
                <div>📦 Receives</div>
                <div style="font-size: 24px; font-weight: bold;">${summary.totalReceives}</div>
                <div>Total Qty: ${summary.totalReceiveQty}</div>
            </div>
            <div style="background: #ffc107; color: black; padding: 10px; border-radius: 5px; text-align: center;">
                <div>✏️ Issues</div>
                <div style="font-size: 24px; font-weight: bold;">${summary.totalIssues}</div>
                <div>Total Qty: ${summary.totalIssueQty}</div>
            </div>
            <div style="background: #17a2b8; color: white; padding: 10px; border-radius: 5px; text-align: center;">
                <div>📊 Counts</div>
                <div style="font-size: 24px; font-weight: bold;">${summary.totalCounts}</div>
            </div>
            <div style="background: #6c757d; color: white; padding: 10px; border-radius: 5px; text-align: center;">
                <div>➕ Adds</div>
                <div style="font-size: 24px; font-weight: bold;">${summary.totalAdds}</div>
            </div>
        </div>
        <div style="margin-top: 10px; color: #dc3545; text-align: right;">
            Deleted Items: ${summary.totalDeletes}
        </div>
    `;
    
    // Build table
    let tableHtml = '';
    reportActivities.forEach(a => {
        let actionColor = a.action === 'RECEIVE' ? '#28a745' : 
                         a.action === 'ISSUE' ? '#ffc107' :
                         a.action === 'COUNT' ? '#17a2b8' :
                         a.action === 'ADD' ? '#007bff' : '#dc3545';
        
        tableHtml += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(a.timestamp).toLocaleString()}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${a.material_name || a.material_code || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;"><span style="background: ${actionColor}; color: white; padding: 3px 8px; border-radius: 3px;">${a.action}</span></td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${a.quantity || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${a.note || '-'}</td>
            </tr>
        `;
    });
    
    if (tableHtml === '') {
        tableHtml = '<tr><td colspan="5" style="padding: 20px; text-align: center;">No activities found in this date range</td></tr>';
    }
    
    document.getElementById('reportSummary').innerHTML = summaryHtml;
    document.getElementById('reportTableBody').innerHTML = tableHtml;
    document.getElementById('reportResults').style.display = 'block';
}

// Export report to Excel
function exportReportToExcel() {
    let startDate = document.getElementById('reportStartDate').value;
    let endDate = document.getElementById('reportEndDate').value;
    let reportActivities = getCurrentReportActivities();
    
    if (reportActivities.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Create CSV content
    let csv = "Date,Time,Material Code,Material Name,Action,Quantity,Notes\n";
    
    reportActivities.forEach(a => {
        let date = new Date(a.timestamp);
        let dateStr = date.toLocaleDateString();
        let timeStr = date.toLocaleTimeString();
        let materialCode = a.material_code || '';
        let materialName = a.material_name || '';
        let action = a.action || '';
        let quantity = a.quantity || '';
        let notes = a.note || '';
        
        csv += `"${dateStr}","${timeStr}","${materialCode}","${materialName}","${action}","${quantity}","${notes}"\n`;
    });
    
    // Download CSV
    let blob = new Blob([csv], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `inventory_report_${startDate}_to_${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Helper to get current report activities
function getCurrentReportActivities() {
    let startDate = new Date(document.getElementById('reportStartDate').value);
    let endDate = new Date(document.getElementById('reportEndDate').value);
    endDate.setHours(23, 59, 59);
    
    return activities.filter(a => {
        if (!a || !a.timestamp) return false;
        let activityDate = new Date(a.timestamp);
        return activityDate >= startDate && activityDate <= endDate;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Print report
function printReport() {
    let startDate = document.getElementById('reportStartDate').value;
    let endDate = document.getElementById('reportEndDate').value;
    let summary = document.getElementById('reportSummary').innerHTML;
    let table = document.getElementById('reportTableBody').innerHTML;
    
    let printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Inventory Report ${startDate} to ${endDate}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #333; }
                    .summary { margin: 20px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #007bff; color: white; padding: 8px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <h1>Inventory Activity Report</h1>
                <p>Date Range: ${startDate} to ${endDate}</p>
                <div class="summary">${summary}</div>
                <h3>Detailed Activity</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Material</th>
                            <th>Action</th>
                            <th>Quantity</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${table}
                    </tbody>
                </table>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Simple export all to Excel (quick export)
function exportToExcel() {
    // Create CSV for all materials
    let csv = "Code,Material Name,Category,Stock,Unit,Status\n";
    
    materials.forEach(m => {
        let status = getStockStatus(m.stock);
        csv += `"${m.code}","${m.name}","${m.category}","${m.stock}","${m.unit}","${status}"\n`;
    });
    
    // Download CSV
    let blob = new Blob([csv], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}
// ==================== LOGIN SYSTEM (MODAL VERSION) ====================
let currentUser = null; // 'admin' or 'guest'

// Check if user was already logged in
function checkLoginStatus() {
    let savedUser = localStorage.getItem('currentUser');
    if (savedUser === 'admin' || savedUser === 'guest') {
        currentUser = savedUser;
        applyPermissions();
        
        // Show user badge
        document.getElementById('userBadge').style.display = 'flex';
        document.getElementById('userRole').textContent = currentUser === 'admin' ? '👑 Admin' : '👤 Guest';
        
        // Show password change button for admin
        if (currentUser === 'admin') {
            let changeBtn = document.getElementById('changePasswordBtn');
            if (changeBtn) changeBtn.style.display = 'inline-block';
        }
    } else {
        // Not logged in - show login modal immediately
        setTimeout(() => {
            showLoginModal();
        }, 500); // Small delay to let the page load first
    }
}
// Show login modal (centered overlay)
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('adminPassword').focus();
}
// Close login modal
function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('adminPassword').value = '';
}
// Login as Admin (from modal)
function loginAsAdmin() {
    let password = document.getElementById('adminPassword').value;
    let storedPassword = localStorage.getItem('adminPassword') || 'admin123';
    
    if (password === storedPassword) {
        currentUser = 'admin';
        localStorage.setItem('currentUser', 'admin');
        closeLoginModal();
        
        // Show user badge - INLINE CODE
        let userBadge = document.getElementById('userBadge');
        let userRole = document.getElementById('userRole');
        let changeBtn = document.getElementById('changePasswordBtn');
        
        if (userBadge) userBadge.style.display = 'flex';
        if (userRole) userRole.textContent = '👑 Admin';
        
        applyPermissions();
        
        // Show password change button
        if (changeBtn) changeBtn.style.display = 'inline-block';
    } else {
        document.getElementById('loginError').style.display = 'flex';
    }
}
// Login as Guest
function loginAsGuest() {
    currentUser = 'guest';
    localStorage.setItem('currentUser', 'guest');
    closeLoginModal();
    
    // Show user badge - INLINE CODE
    let userBadge = document.getElementById('userBadge');
    let userRole = document.getElementById('userRole');
    let changeBtn = document.getElementById('changePasswordBtn');
    
    if (userBadge) userBadge.style.display = 'flex';
    if (userRole) userRole.textContent = '👤 Guest';
    
    applyPermissions();
    
    // Hide password change button for guest
    if (changeBtn) changeBtn.style.display = 'none';
}
// Logout
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    
    // Hide user badge
    let userBadge = document.getElementById('userBadge');
    let changeBtn = document.getElementById('changePasswordBtn');
    
    if (userBadge) userBadge.style.display = 'none';
    if (changeBtn) changeBtn.style.display = 'none';
    
    applyPermissions();
    closeLoginModal();
    closePasswordModal();
    
    // Close any open forms
    hideAllForms();
    if (selectedMaterial) {
        document.getElementById('selectedMaterial').classList.add('hidden');
        selectedMaterial = null;
    }
    
    // Show login modal again
    setTimeout(() => {
        showLoginModal();
    }, 300);
}
// Toggle scan mode between Add and Remove
function toggleScanMode() {
    let toggle = document.getElementById('scanModeToggle');
    let modeText = document.getElementById('modeText');
    let modeIcon = document.getElementById('modeIcon');
    
    if (toggle.checked) {
        scanMode = 'remove';
        modeText.textContent = 'Remove';
        modeText.style.color = '#dc3545';
        modeIcon.textContent = '➖';
    } else {
        scanMode = 'add';
        modeText.textContent = 'Add';
        modeText.style.color = '#28a745';
        modeIcon.textContent = '➕';
    }
    
    // Show quick feedback
    showScanFeedback(`Mode: ${scanMode.toUpperCase()}`, null, 'info');
}
// Initialize scan mode toggle
function initScanMode() {
    // Set default state (Add mode)
    let toggle = document.getElementById('scanModeToggle');
    if (toggle) {
        toggle.checked = false;
        scanMode = 'add';
        document.getElementById('modeText').textContent = 'Add';
        document.getElementById('modeText').style.color = '#28a745';
        document.getElementById('modeIcon').textContent = '➕';
    }
}
// ==================== PASSWORD MANAGEMENT ====================
// Show password change modal
function showPasswordModal() {
    document.getElementById('passwordModal').style.display = 'flex';
    document.getElementById('newPassword').focus();
}
// Close password modal
function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('passwordError').style.display = 'none';
}
// Change password
function changePassword() {
    let newPass = document.getElementById('newPassword').value;
    let confirmPass = document.getElementById('confirmPassword').value;
    
    if (!newPass) {
        showPasswordError('Password cannot be empty');
        return;
    }
    
    if (newPass !== confirmPass) {
        showPasswordError('Passwords do not match');
        return;
    }
    
    localStorage.setItem('adminPassword', newPass);
    closePasswordModal();
    alert('✅ Password updated successfully!');
}
// Delete password (no login required)
function deletePassword() {
    if (confirm('⚠️ This will remove password protection. Anyone can access admin features without login. Continue?')) {
        localStorage.removeItem('adminPassword');
        closePasswordModal();
        alert('✅ Password removed. Admin login no longer required.');
    }
}
// Show password error
function showPasswordError(message) {
    let errorDiv = document.getElementById('passwordError');
    errorDiv.innerHTML = `<span>❌</span> ${message}`;
    errorDiv.style.display = 'flex';
}
// Apply permissions based on user role
function applyPermissions() {
    let actionButtons = document.querySelectorAll('.action-btn.delete-btn');
    let stockActions = document.querySelectorAll('.btn-receive, .btn-issue, .btn-count, .btn-edit');
    let addButton = document.querySelector('.btn-add');
    let deleteButtons = document.querySelectorAll('.btn-delete');
    let viewButtons = document.querySelectorAll('.action-btn.edit-btn'); // These are the "View" buttons
    
    // Get admin-only buttons
    let settingsButton = document.getElementById('settingsToggle');
    let weeklyReportButton = document.querySelector('.btn-report');
    
    if (currentUser === 'admin') {
        // Admin: Show everything
        actionButtons.forEach(btn => btn.style.display = 'inline-block');
        stockActions.forEach(btn => btn.style.display = 'inline-block');
        if (addButton) addButton.style.display = 'inline-block';
        deleteButtons.forEach(btn => btn.style.display = 'inline-block');
        // View buttons always show
        viewButtons.forEach(btn => btn.style.display = 'inline-block');
        
        // Show admin-only buttons
        if (settingsButton) settingsButton.style.display = 'inline-block';
        if (weeklyReportButton) weeklyReportButton.style.display = 'inline-block';
    } else if (currentUser === 'guest') {
        // Guest: Hide all action buttons, keep only View and Print
        actionButtons.forEach(btn => btn.style.display = 'none');
        stockActions.forEach(btn => btn.style.display = 'none');
        if (addButton) addButton.style.display = 'none';
        deleteButtons.forEach(btn => btn.style.display = 'none');
        // View buttons stay
        viewButtons.forEach(btn => btn.style.display = 'inline-block');
        
        // Hide admin-only buttons
        if (settingsButton) settingsButton.style.display = 'none';
        if (weeklyReportButton) weeklyReportButton.style.display = 'none';
        
        // Hide any open forms
        hideAllForms();
        if (selectedMaterial) {
            // Refresh the selected material view to hide actions
            selectMaterial(selectedMaterial.code);
        }
    } else {
        // Not logged in: Show login options, hide everything else
        actionButtons.forEach(btn => btn.style.display = 'none');
        stockActions.forEach(btn => btn.style.display = 'none');
        if (addButton) addButton.style.display = 'none';
        deleteButtons.forEach(btn => btn.style.display = 'none');
        viewButtons.forEach(btn => btn.style.display = 'none');
        
        // Hide admin-only buttons
        if (settingsButton) settingsButton.style.display = 'none';
        if (weeklyReportButton) weeklyReportButton.style.display = 'none';
        
        hideAllForms();
        if (selectedMaterial) {
            document.getElementById('selectedMaterial').classList.add('hidden');
            selectedMaterial = null;
        }
    }
    
    // Update table to reflect permissions
    updateTable();
}
// Click outside to close
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('login-overlay')) {
        closeLoginModal();
        closePasswordModal();
    }
});
// Escape key to close
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeLoginModal();
        closePasswordModal();
    }
});
// Initialize database
function initDatabase() {
    console.log('Initializing database...');
    
    // Load materials from localStorage
    let saved = localStorage.getItem('materials');
    if (saved) {
        try {
            materials = JSON.parse(saved);
            
            // 🧹 AUTO-CLEAN: Remove any null entries and fix missing fields
            let originalCount = materials.length;
            
            // Filter out nulls and non-objects
            materials = materials.filter(m => m !== null && typeof m === 'object');
            
            // Fix each material to ensure all fields exist
            materials = materials.map(m => {
                // Skip if material is invalid
                if (!m) return null;
                
                // Ensure all fields exist with defaults
                return {
                    id: m.id || Date.now() + Math.floor(Math.random() * 1000),
                    code: m.code || Math.floor(1 + Math.random() * 999).toString(),
                    name: m.name || 'Unknown Material',
                    category: m.category || 'Steel',
                    stock: typeof m.stock === 'number' ? m.stock : 0,
                    unit: m.unit || 'pieces',
                    remarks: m.remarks || ''
                };
            }).filter(m => m !== null); // Remove any nulls from mapping
            
            if (originalCount !== materials.length) {
                console.log(`🧹 Auto-cleaned: removed ${originalCount - materials.length} invalid entries`);
                saveMaterials(); // Save cleaned data back
            } else {
                console.log('✅ Loaded', materials.length, 'materials from localStorage');
            }
            
        } catch (e) {
            console.error('Error loading materials, resetting data:', e);
            materials = [];
            localStorage.setItem('materials', JSON.stringify([])); // Reset corrupted data
        }
    } else {
        materials = [];
        console.log('✅ Created new materials list');
    }
    
    // Load activities (clean them too)
    let savedActivities = localStorage.getItem('activities');
    if (savedActivities) {
        try {
            activities = JSON.parse(savedActivities);
            // Remove null activities
            let actCount = activities.length;
            activities = activities.filter(a => a !== null);
            if (actCount !== activities.length) {
                localStorage.setItem('activities', JSON.stringify(activities));
            }
        } catch (e) {
            activities = [];
        }
    } else {
        activities = [];
    }
    
    updateTable();
    updateStats();
    updateCategoryFilter(); 
    // Listen for changes from Firebase (other devices)
    if (typeof dbRef !== 'undefined') {
        dbRef.on('value', (snapshot) => {
            let remoteData = snapshot.val();
            if (remoteData && remoteData.length > 0) {
                // Clean remote data too
                let cleanData = remoteData
                    .filter(m => m !== null && typeof m === 'object')
                    .map(m => ({
                        id: m.id || Date.now() + Math.floor(Math.random() * 1000),
                        code: m.code || Math.floor(1 + Math.random() * 999).toString(),
                        name: m.name || 'Unknown Material',
                        category: m.category || 'Steel',
                        stock: typeof m.stock === 'number' ? m.stock : 0,
                        unit: m.unit || 'pieces',
                        remarks: m.remarks || ''
                    }));
                
                // Only update if different from current
                if (JSON.stringify(cleanData) !== JSON.stringify(materials)) {
                    console.log('📡 Received updates from another device');
                    materials = cleanData;
                    localStorage.setItem('materials', JSON.stringify(materials));
                    updateTable();
                    updateStats();
                    updateCategoryFilter();
                    
                    // If selected material exists, update it
                    if (selectedMaterial) {
                        let updated = materials.find(m => m && m.code === selectedMaterial.code);
                        if (updated) {
                            selectedMaterial = updated;
                            selectMaterial(updated.code);
                        }
                    }
                }
            }
        });
    }
}
// Save materials
function saveMaterials() {

    localStorage.setItem('materials', JSON.stringify(materials));
    
    if (typeof dbRef !== 'undefined' && navigator.onLine) {
        dbRef.set(materials).catch(err => {
            console.log('Firebase save failed - will retry later');
        });
    }
    
    updateStats();
    updateTable();
    updateCategoryFilter();
}
// Save activities
function saveActivities() {
    localStorage.setItem('activities', JSON.stringify(activities));
}
// ==================== CORE FUNCTIONS ====================
function generateRandomId() {
    // Generate random 1-3 digit number
    let randomId = Math.floor(1 + Math.random() * 999); // 1-999
    return randomId.toString().padStart(3, '0');
}
// Get stock status
function getStockStatus(stock) {
    if (stock <= 5) return 'Critical';
    if (stock <= 20) return 'Low';
    return 'OK';
}
// Clear remarks field helper
function clearRemarksField(fieldId) {
    let field = document.getElementById(fieldId);
    if (field) field.value = '';
}
// Update stats
function updateStats() {
    document.getElementById('totalItems').textContent = materials.length;
    document.getElementById('criticalCount').textContent = 
        materials.filter(m => m.stock <= 5).length;
    document.getElementById('lowCount').textContent = 
        materials.filter(m => m.stock > 5 && m.stock <= 20).length;
}
// Update table
function updateTable() {
    let filter = document.getElementById('categoryFilter').value;
    let filtered = filter === 'ALL' ? materials : materials.filter(m => m && m.category === filter);
    
    if (!filtered || filtered.length === 0) {
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    📭 No materials found<br>
                    <small>Click "ADD NEW MATERIAL" to get started</small>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    filtered.forEach(m => {
        // Skip if material is null
        if (!m) return;
        
        // Ensure all fields exist
        let code = m.code || 'NO-CODE';
        let name = m.name || 'Unknown';
        let category = m.category || 'Steel';
        let stock = typeof m.stock === 'number' ? m.stock : 0;
        let unit = m.unit || 'pieces';
        
        let status = getStockStatus(stock);
        let statusClass = status === 'Critical' ? 'status-critical' : 
                         status === 'Low' ? 'status-low' : 'status-ok';
        
        // Build actions based on user role - THIS IS THE PERMISSION VERSION
        let actions = `<div class="action-buttons">`;
        
        // View button - always show if logged in
        if (currentUser) {
            actions += `<button onclick='selectMaterial(${JSON.stringify(code)})' class="action-btn edit-btn">View</button>`;
        }
        
        // Print button - always show if logged in
        if (currentUser) {
            // use JSON.stringify to safely quote the values
            actions += `<button onclick='printSingleBarcode(${JSON.stringify(code)}, ${JSON.stringify(name)})' class="action-btn print-btn">🖨️</button>`;

        }
        
        // Delete button - only for admin
        if (currentUser === 'admin') {
           actions += `<button onclick='deleteMaterial(${JSON.stringify(code)})' class="action-btn delete-btn">✗</button>`;
        }
        
        actions += `</div>`;
        
        // If not logged in, show login prompt
        if (!currentUser) {
            actions = `<div style="color: #999; font-size: 12px;">Login to interact</div>`;
        }
        
        html += `
            <tr>
                <td><strong>${code}</strong></td>
                <td><span class="editable-name" data-code="${code}">${name}</span>
                ${(currentUser === 'admin' && m.remarks) ? `<br><small style="color: #666; font-style: italic;">📝 ${m.remarks}</small>` : ''}
                </td>
                <td>${category}</td>
                <td>${stock}</td>
                <td>${unit}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    });
    
    document.getElementById('tableBody').innerHTML = html;
}
// ==================== DUPLICATE DETECTION ====================
function checkDuplicateName(name, currentCode = null) {
    if (!name || name.trim() === '') return false;
    
    name = name.trim().toLowerCase();

    let duplicate = materials.find(m => {
        if (!m || !m.name) return false;
    
        if (currentCode && m.code === currentCode) return false;
        
        return m.name.toLowerCase() === name;
    });
    
    return duplicate || null;
}
function isIdUnique(id) {
    return !materials.some(m => m && m.code === id);
}
// Update category filter dropdown with all categories
function updateCategoryFilter() {
    let filterSelect = document.getElementById('categoryFilter');
    
    // Get unique categories (case-insensitive, with proper caps)
    let categoryMap = new Map();
    
    materials.forEach(m => {
        if (m && m.category) {
            let lowerCat = m.category.toLowerCase();
            // Store the properly capitalized version
            categoryMap.set(lowerCat, m.category);
        }
    });
    
    // Convert to array and sort
    let allCategories = ['ALL', ...Array.from(categoryMap.values()).sort()];
    
    // Save current selection
    let currentValue = filterSelect.value;
    
    // Clear and rebuild options
    filterSelect.innerHTML = '';
    allCategories.forEach(cat => {
        let option = document.createElement('option');
        option.value = cat === 'ALL' ? 'ALL' : cat;
        option.textContent = cat === 'ALL' ? 'All Categories' : cat;
        if (currentValue === cat || (cat === 'ALL' && currentValue === 'ALL')) {
            option.selected = true;
        }
        filterSelect.appendChild(option);
    });
}
// Filter materials
function filterMaterials() {
    updateTable();
}
// ==================== ENHANCED SEARCH FUNCTIONS ====================
// Global search variables
let searchTimeout = null;
let lastSearchTerm = '';

// Setup enhanced search
function setupEnhancedSearch() {
    let searchInput = document.getElementById('searchInput');
    
    // Remove any existing listeners
    searchInput.removeEventListener('input', handleSearchInput);
    searchInput.removeEventListener('keypress', handleSearchKeypress);
    
    // Add new listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keypress', handleSearchKeypress);
    
    console.log('🔍 Enhanced search initialized');
}
// Handle real-time search as user types
function handleSearchInput(e) {
    let searchTerm = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // If search is empty, show all materials
    if (searchTerm === '') {
        updateTable();
        hideSearchResults();
        return;
    }
    
    // Set timeout to search after user stops typing (300ms)
    searchTimeout = setTimeout(() => {
        performSmartSearch(searchTerm);
    }, 300);
}
// Handle Enter key press
function handleSearchKeypress(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        let searchTerm = e.target.value.trim();
        
        if (searchTerm) {
            // Clear any pending timeout
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            let results = performSmartSearch(searchTerm, true);
             if (results && results.length > 0) {
                selectMaterial(results[0].code);
            }
        }
    }
}
// Perform smart search (fuzzy, case-insensitive)
function performSmartSearch(searchTerm, prioritizeExact = false) {
    if (!searchTerm || searchTerm.length < 1) {
        updateTable();
        return [];
    }
    
    searchTerm = searchTerm.toLowerCase();
    console.log('Searching for:', searchTerm);
    
    // Score each material based on relevance
    let results = materials.map(material => {
        let score = 0;
        let nameLower = (material.name || '').toLowerCase();
        let codeLower = (material.code || '').toLowerCase();
        let categoryLower = (material.category || '').toLowerCase();
        
        // Exact matches (highest score)
        if (codeLower === searchTerm) score += 100;
        else if (nameLower === searchTerm) score += 90;
        
        // Starts with search term
        if (codeLower.startsWith(searchTerm)) score += 50;
        if (nameLower.startsWith(searchTerm)) score += 45;
        
        // Contains search term
        if (codeLower.includes(searchTerm)) score += 30;
        if (nameLower.includes(searchTerm)) score += 25;
        if (categoryLower.includes(searchTerm)) score += 10;
        
        // Word boundary matches (e.g., "16mm" matches "16mm Round Bar")
        let words = nameLower.split(' ');
        words.forEach(word => {
            if (word.startsWith(searchTerm)) score += 20;
            if (word.includes(searchTerm)) score += 5;
        });
        
        // Partial matches for short search terms (1-2 letters)
        if (searchTerm.length === 1) {
            if (codeLower.includes(searchTerm)) score += 2;
            if (nameLower.includes(searchTerm)) score += 1;
        }
        
        return {
            material: material,
            score: score
        };
    });
    
    // Filter out zero scores and sort by score (highest first)
    let filteredResults = results
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(r => r.material);
    
    // If we have results, show them
    if (filteredResults.length > 0) {
        showSearchResults(filteredResults, searchTerm);
    } else {
        // No results found
        showNoResults(searchTerm);
    }
        return filteredResults;
}
// Show search results in table
function showSearchResults(results, searchTerm) {
    let tableBody = document.getElementById('tableBody');
    
    if (results.length === 0) {
        showNoResults(searchTerm);
        return;
    }
    
    let html = '';
    results.forEach(m => {
        if (!m) return;
        
        let code = m.code || 'NO-CODE';
        let name = m.name || 'Unknown';
        let category = m.category || 'Steel';
        let stock = typeof m.stock === 'number' ? m.stock : 0;
        let unit = m.unit || 'pieces';
        
        // Highlight matching text (optional)
        let highlightedName = highlightMatch(name, searchTerm);
        let highlightedCode = highlightMatch(code, searchTerm);
        
        let status = getStockStatus(stock);
        let statusClass = status === 'Critical' ? 'status-critical' : 
                         status === 'Low' ? 'status-low' : 'status-ok';
        
// In showSearchResults, replace that whole block with just:
let actions = `<div class="action-buttons">`;
actions += `<button onclick='selectMaterial(${JSON.stringify(code)})' class="action-btn edit-btn">View</button>`;
actions += `<button onclick='printSingleBarcode(${JSON.stringify(code)}, ${JSON.stringify(name)})' class="action-btn print-btn">🖨️</button>`;
actions += `<button onclick='deleteMaterial(${JSON.stringify(code)})' class="action-btn delete-btn">✗</button>`;

// If not logged in, show login prompt
if (!currentUser) {
    actions = `<div style="color: #999; font-size: 12px;">Login to interact</div>`;
}

html += `
    <tr>
        <td><strong>${code}</strong></td>
        <td>
            <span class="editable-name" data-code="${code}">${highlightedName || name}</span>
            ${m.remarks ? `<br><small style="color: #666; font-style: italic;">📝 ${m.remarks}</small>` : ''}
        </td>
        <td>${category}</td>
        <td>${stock}</td>
        <td>${unit}</td>
        <td><span class="status-badge ${statusClass}">${status}</span></td>
        <td>${actions}</td>
    </tr>
`;
    });
    
    // Add search result summary
    let resultSummary = `
        <div style="margin: 10px 0; padding: 8px; background: #e3f2fd; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span>🔍 Found <strong>${results.length}</strong> result${results.length > 1 ? 's' : ''} for "${searchTerm}"</span>
            <button onclick="clearSearch()" style="background: none; border: none; color: #2196f3; cursor: pointer; font-size: 14px;">✕ Clear search</button>
        </div>
    `;
    
    tableBody.innerHTML = resultSummary + html;
}
// Highlight matching text
function highlightMatch(text, searchTerm) {
    if (!text || !searchTerm) return text;
    
    let lowerText = text.toLowerCase();
    let lowerSearch = searchTerm.toLowerCase();
    let index = lowerText.indexOf(lowerSearch);
    
    if (index === -1) return text;
    
    let before = text.substring(0, index);
    let match = text.substring(index, index + searchTerm.length);
    let after = text.substring(index + searchTerm.length);
    
    return `${before}<span style="background-color: #fff3cd; font-weight: bold;">${match}</span>${after}`;
}
// Show no results message
function showNoResults(searchTerm) {
    let tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                <strong>No materials found for "${searchTerm}"</strong><br>
                <small>Try a different search term or</small><br>
                <button onclick="showAddForm()" class="btn-add" style="margin-top: 15px;">➕ Add New Material</button>
                <button onclick="clearSearch()" style="margin-left: 10px; padding: 8px 16px;">Clear Search</button>
            </td>
        </tr>
    `;
}
// Clear search and show all materials
function clearSearch() {
    document.getElementById('searchInput').value = '';
    updateTable();
    hideSearchResults();
}
// Hide any search-specific UI
function hideSearchResults() {
    // Table will show all materials via updateTable()
}
// Legacy search function 
function searchMaterial(barcode) {
    let searchTerm = barcode || document.getElementById('searchInput').value.trim();
    if (!searchTerm || searchTerm === '') return;
    
    if (searchTerm.toLowerCase() === 'enter') {
        document.getElementById('searchInput').value = '';
        return;
    }
    
    performSmartSearch(searchTerm, true);
}
// Select material
function selectMaterial(code) {
    let material = materials.find(m => m.code === code);
    if (!material) return;
    
    selectedMaterial = material;
    
    let status = getStockStatus(material.stock);
    let statusClass = status === 'Critical' ? 'status-critical' : 
                      status === 'Low' ? 'status-low' : 'status-ok';
    
    // Stock Actions - only show for admin
// Stock Actions - only show for admin
let stockActions = '';
if (currentUser === 'admin') {
    stockActions = `
        <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin-bottom: 10px; color: #495057;">📦 Stock Actions</h3>
            <div class="material-actions">
                <button onclick="showReceiveForm('${material.code}')" class="btn-receive">📦 Expand</button>
                <button onclick="showIssueForm('${material.code}')" class="btn-issue">✏️ Modify Stock</button>
                <button onclick="showCountForm('${material.code}')" class="btn-count">📊 Count</button>
            </div>
        </div>
    `;
}

// Edit Details - only show for admin
let editActions = '';
if (currentUser === 'admin') {
    editActions = `
        <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin-bottom: 10px; color: #495057;">✏️ Edit Details</h3>
            <div class="material-actions">
                <button onclick="showEditCategoryForm('${material.code}')" class="btn-edit" style="background: #fd7e14; color: white;">📁 Change Category</button>
                <button onclick="showEditUnitForm('${material.code}')" class="btn-edit" style="background: #20c997; color: white;">📏 Change Unit</button>
                <button onclick='printSingleBarcode(${JSON.stringify(material.code)}, ${JSON.stringify(material.name)})' class="btn-print">🖨️ Print Label</button>
                <button onclick='deleteMaterial(${JSON.stringify(material.code)})' class="btn-delete">🗑️ Delete</button>
            </div>
        </div>
    `;
} else if (currentUser === 'guest') {
    // Guest - only show print button
    editActions = `
        <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin-bottom: 10px; color: #495057;">🖨️ Actions</h3>
            <div class="material-actions">
                <button onclick='printSingleBarcode(${JSON.stringify(material.code)}, ${JSON.stringify(material.name)})' class="btn-print">🖨️ Print Label</button>
            </div>
        </div>
    `;
}

// Build the complete HTML
let html = `
    <h2>Selected: ${material.name} (${material.code})</h2>
    <div class="material-details">
        <div class="detail-item">
            <div class="detail-label">Current Stock</div>
            <div class="detail-value ${statusClass}">${material.stock} ${material.unit}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Category</div>
            <div class="detail-value">${material.category}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Unit</div>
            <div class="detail-value">${material.unit}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Last Updated</div>
            <div class="detail-value">${new Date().toLocaleDateString()}</div>
        </div>
    </div>
    
    ${material.remarks ? `
    <div style="margin: 15px 0; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
        <strong style="color: #856404;">📝 Remarks:</strong>
        <p style="margin: 5px 0 0; color: #856404;">${material.remarks}</p>
    </div>
    ` : ''}

    ${stockActions}
    ${editActions}
`;
    document.getElementById('selectedMaterialContent').innerHTML = html;
    document.getElementById('selectedMaterial').classList.remove('hidden');
}
// ==================== FORM HANDLING ====================
function hideAllForms() {
    document.getElementById('addForm').classList.add('hidden');
    document.getElementById('receiveForm').classList.add('hidden');
    document.getElementById('issueForm').classList.add('hidden');
    document.getElementById('countForm').classList.add('hidden');
    let editCategoryForm = document.getElementById('editCategoryForm');
    if (editCategoryForm) editCategoryForm.remove();
    
    let editUnitForm = document.getElementById('editUnitForm');
    if (editUnitForm) editUnitForm.remove();
}
function showAddForm() {
    hideAllForms();
    document.getElementById('addForm').classList.remove('hidden');
    
    // Focus on the first material name field
    let firstNameField = document.querySelector('.material-name');
    if (firstNameField) firstNameField.focus();
}
function showReceiveForm(materialCode) {
    hideAllForms();
    let material = materials.find(m => m.code === materialCode);
    if (!material) return;
    
    document.getElementById('receiveMaterialInfo').innerHTML = 
        `<strong>${material.name}</strong> (${material.code})<br>Current Stock: ${material.stock} ${material.unit}`;
    document.getElementById('receiveForm').dataset.code = material.code;
    document.getElementById('receiveForm').classList.remove('hidden');
    document.getElementById('receiveQty').focus();
    clearRemarksField('receiveRemarks');
}
function showIssueForm(materialCode) {
    hideAllForms();
    let material = materials.find(m => m.code === materialCode);
    if (!material) return;
    
    document.getElementById('issueMaterialInfo').innerHTML = 
        `<strong>${material.name}</strong> (${material.code})<br>Current Stock: ${material.stock} ${material.unit}`;
    document.getElementById('issueForm').dataset.code = material.code;
    document.getElementById('issueForm').classList.remove('hidden');
    document.getElementById('issueQty').focus();
    clearRemarksField('issueRemarks');
}

// Show count form
function showCountForm(materialCode) {
    hideAllForms();
    let material = materials.find(m => m.code === materialCode);
    if (!material) return;
    
    document.getElementById('countMaterialInfo').innerHTML = 
        `<strong>${material.name}</strong> (${material.code})<br>Current Stock: ${material.stock} ${material.unit}`;
    document.getElementById('countForm').dataset.code = material.code;
    document.getElementById('countForm').classList.remove('hidden');
    document.getElementById('countQty').focus();
    clearRemarksField('countRemarks');
}
// Stock count adjustment
function saveCount() {
    let code = document.getElementById('countForm').dataset.code;
    let actual = parseInt(document.getElementById('countQty').value);
    let remarks = document.getElementById('countRemarks').value.trim();
    
    if (isNaN(actual) || actual < 0) {
        alert('Enter valid quantity');
        return;
    }
    
    let material = materials.find(m => m.code === code);
    if (!material) {
        alert('Material not found');
        return;
    }
    
    let oldStock = material.stock;
    let difference = actual - oldStock;
    material.stock = actual;
    
    // Update material remarks if provided
    if (remarks) {
        material.remarks = remarks;
    }
    
    saveMaterials();
    
    // Add activity
    activities.unshift({
        id: Date.now(),
        action: 'COUNT',
        material_code: code,
        material_name: material.name,
        quantity: difference,
        old_stock: oldStock,
        new_stock: actual,
        note: remarks || 'Physical count adjustment',
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    selectMaterial(code);
    hideAllForms();
    
    document.getElementById('countQty').value = '';
    clearRemarksField('countRemarks');
    
    alert(`✅ Stock updated\nOld: ${oldStock} → New: ${actual}`);
}
// ==================== EDIT CATEGORY & UNIT FUNCTIONS ====================
function showEditCategoryForm(materialCode) {
    hideAllForms();
    let material = materials.find(m => m.code === materialCode);
    if (!material) {
        alert('Material not found');
        return;
    }
    
    console.log('Editing category for:', material);
    
    // Get ALL unique categories (case-insensitive, with proper capitalization)
    let categoryMap = new Map(); // Use Map to store proper case version
    
    // First, collect all categories from materials
    materials.forEach(m => {
        if (m && m.category) {
            let lowerCat = m.category.toLowerCase();
            // Store the properly capitalized version (first letter caps)
            let properCat = m.category.charAt(0).toUpperCase() + m.category.slice(1).toLowerCase();
            categoryMap.set(lowerCat, properCat);
        }
    });
    
    // Convert map to array and sort
    let allCategories = Array.from(categoryMap.values()).sort();
    
    console.log('All unique categories:', allCategories);
    
    // Build dropdown options
    let options = '';
    allCategories.forEach(cat => {
        let selected = (cat.toLowerCase() === material.category.toLowerCase()) ? 'selected' : '';
        options += `<option value="${cat}" ${selected}>${cat}</option>`;
    });
    
    // Add option for new category
    options += `<option value="__new__">➕ Add New Category...</option>`;
    
    let formHtml = `
        <div id="editCategoryForm" class="form-card">
            <h3>📁 Change Category</h3>
            <p><strong>${material.name}</strong> (${material.code})</p>
            <p>Current Category: <strong>${material.category}</strong></p>
            
            <select id="editCategorySelect" onchange="toggleEditCustomCategory()">
                ${options}
            </select>
            
            <input type="text" id="editCustomCategory" placeholder="Enter new category name" style="display: none; margin-top: 10px;">
            
            <div class="form-actions" style="margin-top: 20px;">
                <button onclick="saveCategoryUpdate('${material.code}')" class="btn-save">Update Category</button>
                <button onclick="hideAllForms()" class="btn-cancel">Cancel</button>
            </div>
        </div>
    `;
    
    // Remove any existing edit form first
    let existingForm = document.getElementById('editCategoryForm');
    if (existingForm) existingForm.remove();
    
    // Insert new form
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = formHtml;
    document.getElementById('actionForms').appendChild(tempDiv);
}
function toggleEditCustomCategory() {
    let select = document.getElementById('editCategorySelect');
    let customInput = document.getElementById('editCustomCategory');
    
    if (select.value === '__new__') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}
function saveCategoryUpdate(code) {
    let material = materials.find(m => m.code === code);
    if (!material) return;
    
    let select = document.getElementById('editCategorySelect');
    let customInput = document.getElementById('editCustomCategory');
    let newCategory;
    
    if (select.value === '__new__') {
        newCategory = customInput.value.trim();
        if (!newCategory) {
            alert('Please enter a category name');
            return;
        }
        // Capitalize first letter for new category
        newCategory = newCategory.charAt(0).toUpperCase() + newCategory.slice(1).toLowerCase();
    } else {
        newCategory = select.value; // Already properly capitalized from dropdown
    }
    
    // Check if actually changed (case-insensitive)
    if (newCategory.toLowerCase() === material.category.toLowerCase()) {
        alert('Category unchanged');
        hideAllForms();
        selectMaterial(code);
        return;
    }
    
    let oldCategory = material.category;
    material.category = newCategory;
    
    saveMaterials();
    
    // Add activity
    activities.unshift({
        id: Date.now(),
        action: 'EDIT_CATEGORY',
        material_code: code,
        material_name: material.name,
        old_value: oldCategory,
        new_value: newCategory,
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    hideAllForms();
    selectMaterial(code);
    
    alert(`✅ Category updated: ${oldCategory} → ${newCategory}`);
}
// ==================== EDIT UNIT FUNCTIONS ====================
function showEditUnitForm(materialCode) {
    hideAllForms();
    let material = materials.find(m => m.code === materialCode);
    if (!material) return;
    
    // Common units for suggestions
    let commonUnits = ['pieces', 'pairs', 'kg', 'meters', 'boxes', 'cans', 'liters', 'sheets'];
    
    let formHtml = `
        <div id="editUnitForm" class="form-card">
            <h3>📏 Change Unit</h3>
            <p><strong>${material.name}</strong> (${material.code})</p>
            <p>Current Unit: <strong>${material.unit}</strong></p>
            
            <select id="editUnitSelect" onchange="toggleEditCustomUnit()">
                <option value="">-- Select Unit --</option>
                ${commonUnits.map(unit => 
                    `<option value="${unit}" ${material.unit === unit ? 'selected' : ''}>${unit}</option>`
                ).join('')}
                <option value="__custom__">➕ Add Custom Unit...</option>
            </select>
            
            <input type="text" id="editCustomUnit" placeholder="Enter custom unit" style="display: none; margin-top: 10px;">
            
            <div class="form-actions" style="margin-top: 20px;">
                <button onclick="saveUnitUpdate('${material.code}')" class="btn-save">Update Unit</button>
                <button onclick="hideAllForms()" class="btn-cancel">Cancel</button>
            </div>
        </div>
    `;
    
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = formHtml;
    document.getElementById('actionForms').appendChild(tempDiv);
}
function toggleEditCustomUnit() {
    let select = document.getElementById('editUnitSelect');
    let customInput = document.getElementById('editCustomUnit');
    
    if (select.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

function saveUnitUpdate(code) {
    let material = materials.find(m => m.code === code);
    if (!material) return;
    
    let select = document.getElementById('editUnitSelect');
    let customInput = document.getElementById('editCustomUnit');
    let newUnit;
    
    if (select.value === '__custom__') {
        newUnit = customInput.value.trim();
        if (!newUnit) {
            alert('Please enter a unit');
            return;
        }
    } else if (select.value) {
        newUnit = select.value;
    } else {
        alert('Please select or enter a unit');
        return;
    }
    
    if (newUnit === material.unit) {
        alert('Unit unchanged');
        hideAllForms();
        selectMaterial(code);
        return;
    }
    
    let oldUnit = material.unit;
    material.unit = newUnit;
    
    saveMaterials();
    
    // Add activity
    activities.unshift({
        id: Date.now(),
        action: 'EDIT_UNIT',
        material_code: code,
        material_name: material.name,
        old_value: oldUnit,
        new_value: newUnit,
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    hideAllForms();
    selectMaterial(code);
    
    alert(`✅ Unit updated: ${oldUnit} → ${newUnit}`);
}

// ==================== CUSTOM CATEGORY HANDLER ====================
function toggleCustomCategory() {
    let select = document.getElementById('newCategory');
    let customInput = document.getElementById('customCategory');
    
    if (select.value === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

function getSelectedCategory() {
    let select = document.getElementById('newCategory');
    let customInput = document.getElementById('customCategory');
    let category;
    
    if (select.value === 'custom') {
        category = customInput.value.trim() || 'Misc';
    } else {
        category = select.value;
    }
    
    // Standardize: first letter caps, rest lowercase
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

// ==================== BULK MATERIAL ADD FUNCTIONS ====================

// Add a new material row to the bulk add form
function addMaterialRow() {
    let container = document.getElementById('materialsContainer');
    let rowCount = container.querySelectorAll('.material-row').length;
    
    let rowHtml = `
        <div class="material-row" data-row="${rowCount}">
            <input type="text" class="material-name" placeholder="Material Name (e.g., 16mm Round Bar)">
            <input type="text" class="material-category" placeholder="Category (auto-created if new)">
            <input type="text" class="material-unit" placeholder="Unit (pieces, kg, etc.)" value="pieces">
            <input type="number" class="material-stock" placeholder="Quantity" value="0">
            <input type="text" class="material-remarks" placeholder="Remarks (optional)">
            <button type="button" class="remove-row-btn" onclick="removeMaterialRow(this)">✗</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
    
    // Show remove buttons if we have more than 1 row
    let removeButtons = container.querySelectorAll('.remove-row-btn');
    if (removeButtons.length > 1) {
        removeButtons.forEach(btn => btn.style.display = 'flex');
    }
}

// Remove a material row from the bulk add form
function removeMaterialRow(button) {
    let row = button.closest('.material-row');
    let container = document.getElementById('materialsContainer');
    
    row.remove();
    
    // Hide remove buttons if we only have 1 row left
    let remainingRows = container.querySelectorAll('.material-row');
    if (remainingRows.length === 1) {
        let removeBtn = remainingRows[0].querySelector('.remove-row-btn');
        if (removeBtn) removeBtn.style.display = 'none';
    }
    
    // Re-index the rows
    remainingRows.forEach((row, index) => {
        row.setAttribute('data-row', index);
    });
}

// Save all materials from the bulk add form
function saveBulkMaterials() {
    let container = document.getElementById('materialsContainer');
    let rows = container.querySelectorAll('.material-row');
    let addedMaterials = [];
    let errors = [];
    
    rows.forEach((row, index) => {
        let name = row.querySelector('.material-name').value.trim();
        let category = row.querySelector('.material-category').value.trim();
        let unit = row.querySelector('.material-unit').value.trim() || 'pieces';
        let stock = parseInt(row.querySelector('.material-stock').value) || 0;
        let remarks = row.querySelector('.material-remarks').value.trim();
        
        // Validate required fields
        if (!name) {
            errors.push(`Row ${index + 1}: Material name is required`);
            return;
        }
        
        if (!category) {
            errors.push(`Row ${index + 1}: Category is required`);
            return;
        }
        
        // Check for duplicates
        let duplicate = checkDuplicateName(name);
        if (duplicate) {
            let confirmMsg = `⚠️ Row ${index + 1}: "${name}" is very similar to existing material:\n\n` +
                            `Existing: ${duplicate.name} (ID: ${duplicate.code})\n\n` +
                            `Skip this material?`;
            
            if (!confirm(confirmMsg)) {
                return; // Skip this material
            }
        }
        
        // Standardize category (first letter caps)
        category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
        
        // Generate unique ID
        let id = generateRandomId();
        while (materials.some(m => m && m.code === id)) {
            id = generateRandomId();
        }
        
        let newMaterial = {
            id: Date.now() + index, // Ensure unique IDs
            code: id,
            name: name,
            category: category,
            stock: stock,
            unit: unit,
            remarks: remarks
        };
        
        addedMaterials.push(newMaterial);
    });
    
    // Show errors if any
    if (errors.length > 0) {
        alert('❌ Please fix the following errors:\n\n' + errors.join('\n\n'));
        return;
    }
    
    // Show confirmation
    if (addedMaterials.length === 0) {
        alert('❌ No valid materials to add');
        return;
    }
    
    let confirmMsg = `✅ Add ${addedMaterials.length} material(s)?\n\n` +
                    addedMaterials.map(m => `${m.name} (${m.category})`).join('\n');
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // Add all materials
    let addedCount = 0;
    addedMaterials.forEach(material => {
        materials.push(material);
        
        // Add activity
        activities.unshift({
            id: Date.now() + Math.random(),
            action: 'ADD',
            material_code: material.code,
            material_name: material.name,
            quantity: material.stock,
            timestamp: new Date().toLocaleString()
        });
        
        addedCount++;
    });
    
    saveMaterials();
    saveActivities();
    
    updateTable();
    updateCategoryFilter();
    hideAllForms();
    
    alert(`✅ Successfully added ${addedCount} material(s)!`);
    
    // Reset form to one empty row
    document.getElementById('materialsContainer').innerHTML = `
        <div class="material-row" data-row="0">
            <input type="text" class="material-name" placeholder="Material Name (e.g., 16mm Round Bar)">
            <input type="text" class="material-category" placeholder="Category (auto-created if new)">
            <input type="text" class="material-unit" placeholder="Unit (pieces, kg, etc.)" value="pieces">
            <input type="number" class="material-stock" placeholder="Quantity" value="0">
            <input type="text" class="material-remarks" placeholder="Remarks (optional)">
            <button type="button" class="remove-row-btn" onclick="removeMaterialRow(this)" style="display: none;">✗</button>
        </div>
    `;
}

function saveNewMaterial() {
    let name = document.getElementById('newName').value.trim();
    let category = getSelectedCategory();
    let unit = document.getElementById('newUnit').value.trim() || 'pieces';
    let stock = parseInt(document.getElementById('newStock').value) || 0;
    let remarks = document.getElementById('newRemarks') ? document.getElementById('newRemarks').value.trim() : '';
    
    if (!name) {
        alert('Material name is required');
        return;
    }
    
    // Check for duplicates
    let duplicate = checkDuplicateName(name);
    if (duplicate) {
        let confirmMsg = `⚠️ "${name}" is very similar to existing material:\n\n` +
                        `Existing: ${duplicate.name} (ID: ${duplicate.code})\n` +
                        `Stock: ${duplicate.stock} ${duplicate.unit}\n\n` +
                        `Do you still want to add as new material?`;
        
        if (!confirm(confirmMsg)) {
            if (confirm('View existing material instead?')) {
                selectMaterial(duplicate.code);
                hideAllForms();
            }
            return;
        }
    }
    
    // Generate random 6-digit ID
    let id = generateRandomId();
    
    // Make sure ID is unique
    while (materials.some(m => m && m.code === id)) {
        id = generateRandomId();
    }
    
    let newMaterial = {
        id: Date.now(),
        code: id,
        name: name,
        category: category,
        stock: stock,
        unit: unit,
        remarks: remarks
    };
    
    materials.push(newMaterial);
    saveMaterials();
    
    // Add activity
    activities.unshift({
        id: Date.now(),
        action: 'ADD',
        material_code: id,
        material_name: name,
        quantity: stock,
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    hideAllForms();
    selectMaterial(id);
    
    alert(`✅ Material added!\nID: ${id}`);
    
    // Clear form
    document.getElementById('newName').value = '';
    document.getElementById('newStock').value = '0';
    if (document.getElementById('newRemarks')) document.getElementById('newRemarks').value = '';
}

// Receive stock 
function saveReceive() {
    let code = document.getElementById('receiveForm').dataset.code;
    let qty = parseInt(document.getElementById('receiveQty').value);
    let remarks = document.getElementById('receiveRemarks').value.trim();
    
    if (!qty || qty < 1) {
        alert('Enter valid quantity');
        return;
    }
    
    let material = materials.find(m => m.code === code);
    if (!material) {
        alert('Material not found');
        return;
    }
    
    let oldStock = material.stock;
    material.stock += qty;
    
    // Update material remarks if provided
    if (remarks) {
        material.remarks = remarks;
    }
    
    saveMaterials();
    
    // Add activity 
    activities.unshift({
        id: Date.now(),
        action: 'RECEIVE',
        material_code: code,
        material_name: material.name,
        quantity: qty,
        old_stock: oldStock,
        new_stock: material.stock,
        note: remarks || 'Manual expand',
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    selectMaterial(code);
    hideAllForms();
    
    document.getElementById('receiveQty').value = '';
    clearRemarksField('receiveRemarks');
    
    alert(`✅ Added ${qty} ${material.unit}\nNew stock: ${material.stock}`);
}

// Issue stock (Modify)
function saveIssue() {
    let code = document.getElementById('issueForm').dataset.code;
    let qty = parseInt(document.getElementById('issueQty').value);
    let remarks = document.getElementById('issueRemarks').value.trim()
    
    if (!qty || qty < 1) {
        alert('Enter valid quantity');
        return;
    }
    
    let material = materials.find(m => m.code === code);
    if (!material) {
        alert('Material not found');
        return;
    }
    
    if (material.stock < qty) {
        alert(`❌ Only ${material.stock} available!`);
        return;
    }
    
    let oldStock = material.stock;
    material.stock -= qty;
    
    // Update material remarks if provided
    if (remarks) {
        material.remarks = remarks;
    }
    
    saveMaterials();
    
    // Add activity (simplified)
    activities.unshift({
        id: Date.now(),
        action: 'ISSUE',
        material_code: code,
        material_name: material.name,
        quantity: qty,
        old_stock: oldStock,
        new_stock: material.stock,
        note: remarks || 'Manual modify',
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    selectMaterial(code);
    hideAllForms();
    
    document.getElementById('issueQty').value = '';
    clearRemarksField('issueRemarks');
    
    alert(`✅ Removed ${qty} ${material.unit}\nNew stock: ${material.stock}`);
}

// Delete material
function deleteMaterial(code) {
    if (!confirm('⚠️ Delete this material? This cannot be undone.')) return;
    
    let material = materials.find(m => m.code === code);
    materials = materials.filter(m => m.code !== code);
    saveMaterials();
    
    // Add activity
    activities.unshift({
        id: Date.now(),
        action: 'DELETE',
        material_code: code,
        material_name: material ? material.name : code,
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    
    if (selectedMaterial && selectedMaterial.code === code) {
        document.getElementById('selectedMaterial').classList.add('hidden');
        selectedMaterial = null;
    }
    
    alert(`✅ Deleted: ${material ? material.name : code}`);
}

// ==================== INLINE EDIT HELPERS ====================

// attach dblclick handler to table body to enable editing of material names
function setupInlineEditing() {
    let tableBody = document.getElementById('tableBody');
    if (!tableBody) return;

    tableBody.addEventListener('dblclick', function(e) {
        let target = e.target;
        if (!target.classList.contains('editable-name')) return;
        let code = target.dataset.code;
        if (!code) return;

        let oldName = target.textContent.trim();
        let input = document.createElement('input');
        input.type = 'text';
        input.value = oldName;
        input.className = 'inline-name-input';
        target.innerHTML = '';
        target.appendChild(input);
        input.focus();
        input.select();

        function finishEdit(save) {
            let newName = save ? input.value.trim() : oldName;
            if (newName === '') newName = oldName;

            if (save && newName !== oldName) {
                // duplicate check
                let dup = checkDuplicateName(newName, code);
                if (dup && dup.code !== code) {
                    if (!confirm(`⚠️ "${newName}" is similar to existing material: ${dup.name} (${dup.code}). Use anyway?`)) {
                        newName = oldName;
                    }
                }
                if (newName !== oldName) {
                    let mat = materials.find(m => m.code === code);
                    if (mat) {
                        mat.name = newName;
                        saveMaterials();
                        activities.unshift({
                            id: Date.now(),
                            action: 'EDIT_NAME',
                            material_code: code,
                            material_name: newName,
                            old_value: oldName,
                            new_value: newName,
                            timestamp: new Date().toLocaleString()
                        });
                        saveActivities();
                    }
                }
            }

            // restore display
            target.textContent = newName === '' ? oldName : newName;
            updateTable();
        }

        input.addEventListener('blur', function() { finishEdit(true); });
        input.addEventListener('keydown', function(ev) {
            if (ev.key === 'Enter') {
                input.blur();
            } else if (ev.key === 'Escape') {
                finishEdit(false);
            }
        });
    });
}


// ==================== BARCODE FUNCTIONS ====================

function printSingleBarcode(code, name) {
    // ensure we have a value to print
    if (!code) {
        alert('❌ No barcode data available');
        return;
    }
    // some codes may contain characters that break the URL (spaces, &, ? etc.)
    let encoded = encodeURIComponent(code);
    document.getElementById('barcodePreview').innerHTML = `
        <div style="text-align:center;">
            <img src="https://barcode.tec-it.com/barcode.ashx?data=${encoded}&code=Code128&dpi=96&imagetype=png" 
                 style="max-width:100%;" alt="Barcode">
            <h4>${code}</h4>
            <p>${name || ''}</p>
        </div>
    `;
    document.getElementById('barcodeModal').classList.remove('hidden');
}
function closeBarcodeModal() {
    document.getElementById('barcodeModal').classList.add('hidden');
}

function printBarcodeLabel() {
    window.print();
    setTimeout(() => {
        closeBarcodeModal();
    }, 1000);
}

// ==================== SCANNER DETECTION ====================

function setupScannerDetection() {
    document.addEventListener('keypress', function(e) {
        let currentTime = new Date().getTime();
        
        if (currentTime - lastKeyTime < 50) {
            scanBuffer += e.key;
        } else {
            scanBuffer = e.key;
        }
        
        lastKeyTime = currentTime;
        
        if (e.key === "Enter" && scanBuffer.length > 1) {
            let barcode = scanBuffer.trim();
            document.getElementById('searchInput').value = barcode;
            searchMaterial(barcode);
            scanBuffer = "";
        }
    });
}

// ==================== BUTTON HANDLERS ====================

function setupButtonHandlers() {
    document.querySelector('.btn-add').onclick = function(e) {
        e.preventDefault();
        showAddForm();
    };
    
    document.querySelector('.search-box button').onclick = function(e) {
        e.preventDefault();
        searchMaterial();
    };
    
    document.getElementById('searchInput').onkeypress = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchMaterial();
        }
    };
    
    document.getElementById('categoryFilter').onchange = function() {
        filterMaterials();
    };
}

// ==================== MOBILE CAMERA SCAN ====================

function toggleCamera() {
    let cameraBtn = document.getElementById('cameraBtn');
    let readerDiv = document.getElementById('reader');
    
    if (!isScanning) {
        // Check if library is loaded
        if (typeof Html5QrcodeScanner === 'undefined') {
            alert('Camera scanner library not loaded. Please refresh the page.');
            console.error('Html5QrcodeScanner is not defined');
            return;
        }
        
        readerDiv.style.display = 'block';
        cameraBtn.textContent = '⏹️ Stop Camera';
        cameraBtn.classList.add('active');
        
        try {
            // Force back camera only with specific constraints
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                rememberLastUsedCamera: true,
                showTorchButtonIfSupported: true,
                // THIS FORCES BACK CAMERA
                videoConstraints: {
                    facingMode: { exact: "environment" }  // "environment" = back camera
                }
            };
            
            html5QrcodeScanner = new Html5QrcodeScanner(
                "reader", 
                config,
                false
            );
            
            html5QrcodeScanner.render(onScanSuccess, onScanError);
            isScanning = true;
            console.log('Camera scanner started (back camera only)');
        } catch (error) {
            console.error('Error starting camera:', error);
            
            // Fallback if "exact" fails (some phones handle it differently)
            try {
                console.log('Trying fallback camera settings...');
                const fallbackConfig = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    rememberLastUsedCamera: true,
                    showTorchButtonIfSupported: true,
                    videoConstraints: {
                        facingMode: "environment"  // Without "exact" - more compatible
                    }
                };
                
                html5QrcodeScanner = new Html5QrcodeScanner(
                    "reader", 
                    fallbackConfig,
                    false
                );
                
                html5QrcodeScanner.render(onScanSuccess, onScanError);
                isScanning = true;
                console.log('Camera scanner started with fallback');
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                alert('Failed to start back camera. Please check permissions.');
                readerDiv.style.display = 'none';
                cameraBtn.textContent = '📷 Scan with Camera';
                cameraBtn.classList.remove('active');
            }
        }
    } else {
        if (html5QrcodeScanner) {
            try {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            } catch (error) {
                console.error('Error stopping camera:', error);
            }
        }
        readerDiv.style.display = 'none';
        cameraBtn.textContent = '📷 Scan with Camera';
        cameraBtn.classList.remove('active');
        isScanning = false;
        console.log('Camera scanner stopped');
    }
}
// Process scan add (auto adds 1)
function processScanAdd(material) {
    let qty = parseInt(document.getElementById('scanQuantity').value) || 1;
    if (qty < 1) qty = 1;
    
    let oldStock = material.stock;
    material.stock += qty;
    
    saveMaterials();
    
    activities.unshift({
        id: Date.now(),
        action: 'RECEIVE',
        material_code: material.code,
        material_name: material.name,
        quantity: qty,
        old_stock: oldStock,
        new_stock: material.stock,
        note: 'Scan receive',
        timestamp: new Date().toLocaleString()
    });
    saveActivities();
    
    updateTable();
    selectMaterial(material.code);
    
    showScanFeedback(`✅ Added ${qty} ${material.unit}`, material.stock);
    
    try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) {}
}
// Process scan remove (auto removes 1)
function processScanRemove(material) {
    let qty = parseInt(document.getElementById('scanQuantity').value) || 1;
    if (qty < 1) qty = 1;

    if (material.stock < qty) {
        showScanFeedback(`❌ Only ${material.stock} available`, null, 'error');
        return;
    }

    let oldStock = material.stock;
    material.stock -= qty;

    saveMaterials();

    activities.unshift({
        id: Date.now(),
        action: 'ISSUE',
        material_code: material.code,
        material_name: material.name,
        quantity: qty,
        old_stock: oldStock,
        new_stock: material.stock,
        note: 'Scan issue',
        timestamp: new Date().toLocaleString()
    });
    saveActivities();

    updateTable();
    selectMaterial(material.code);

    showScanFeedback(`✅ Removed ${qty} ${material.unit}`, material.stock);

    try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) {}
}
// ==================== CAMERA SCAN HANDLER ====================
function onScanSuccess(decodedText, decodedResult) {
    console.log('Scan success:', decodedText, 'Mode:', scanMode);
    
    // Stop camera
    if (isScanning) {
        toggleCamera();
    }
    
    // Put in search box (optional)
    document.getElementById('searchInput').value = decodedText;
    
    // Find the material
    let material = materials.find(m => m.code.toUpperCase() === decodedText.toUpperCase());
    
    if (material) {
        // Material found - process based on current mode
        if (scanMode === 'add') {
            processScanAdd(material);
        } else {
            processScanRemove(material);
        }
    } else {
        // Material not found
        console.log('Material not found:', decodedText);
        showScanFeedback('Unknown barcode', null, 'error');
        
        // Ask if they want to add as new material
        setTimeout(() => {
            if (confirm(`Material not found: ${decodedText}\n\nAdd as new material?`)) {
                document.getElementById('newName').value = decodedText;
                showAddForm();
            }
        }, 500);
    }
}

function onScanError(errorMessage) {
    // Ignore most errors - they're usually just "no barcode found"
    // console.log('Scan error:', errorMessage);
}

// Quick visual feedback that disappears automatically
function showScanFeedback(message, newStock, type = 'success') {
    let toast = document.createElement('div');
    
    // Base styles for all toasts
    let baseStyles = {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '50px',
        fontWeight: 'bold',
        zIndex: '9999',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s, fadeOut 0.5s 1.5s forwards'
    };
    
    // Set message and type-specific styles
    if (type === 'success') {
        toast.textContent = `✅ ${message}`;
        Object.assign(toast.style, { background: '#28a745' });
    } else if (type === 'error') {
        toast.textContent = `❌ ${message}`;
        Object.assign(toast.style, { background: '#dc3545' });
    } else if (type === 'info') {
        toast.textContent = `ℹ️ ${message}`;
        Object.assign(toast.style, { 
            background: '#000000',  // Bright yellow
            color: '#ffffff',          // Black text
            border: '3px solid white',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        });
    }
    
    // Apply all base styles
    Object.assign(toast.style, baseStyles);
    
    document.body.appendChild(toast);
    
    // Auto remove after 2 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 2000);
}

// ==================== CLOSE SELECTED MATERIAL ====================

function closeSelectedMaterial() {
    document.getElementById('selectedMaterial').classList.add('hidden');
    selectedMaterial = null;
    document.getElementById('searchInput').focus();
}

// ==================== KEYBOARD SHORTCUTS ====================

document.addEventListener('keydown', function(e) {
    if (e.key === 'F1') {
        e.preventDefault();
        showAddForm();
    }
    if (e.key === 'F2' && selectedMaterial) {
        e.preventDefault();
        showReceiveForm(selectedMaterial.code);
    }
    if (e.key === 'F3' && selectedMaterial) {
        e.preventDefault();
        showIssueForm(selectedMaterial.code);
    }
    if (e.key === 'Escape') {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchInput').focus();
        if (selectedMaterial) {
            document.getElementById('selectedMaterial').classList.add('hidden');
            selectedMaterial = null;
        }
    }
});



// Run this once to clean up existing categories
function cleanupCategories() {
    console.log('🧹 Cleaning up category case inconsistencies...');
    let changed = false;
    
    materials = materials.map(m => {
        if (m && m.category) {
            // Standardize to first letter caps, rest lowercase
            let properCat = m.category.charAt(0).toUpperCase() + m.category.slice(1).toLowerCase();
            if (m.category !== properCat) {
                console.log(`  Fixing: "${m.category}" → "${properCat}"`);
                m.category = properCat;
                changed = true;
            }
        }
        return m;
    });
    
    if (changed) {
        saveMaterials();
        console.log('✅ Categories cleaned up!');
        updateTable();
        updateCategoryFilter();
    } else {
        console.log('✅ No category cleanup needed');
    }
}

// Run it after initialization
document.addEventListener('DOMContentLoaded', function() {
    initDatabase();
    setupButtonHandlers();
    setupScannerDetection();
    setupEnhancedSearch();
    checkLoginStatus();
    initScanMode()
    setupInlineEditing();
    document.getElementById('searchInput').focus();
    
    // Run cleanup after a short delay
    setTimeout(cleanupCategories, 1000);
});


// ==================== SETTINGS FUNCTIONS ====================

// Toggle settings panel
function toggleSettings() {
    if (currentUser !== 'admin') {
        alert('Admin access required');
        return;
    }
    
    let settingsSection = document.getElementById('settingsSection');
    if (settingsSection.style.display === 'none') {
        settingsSection.style.display = 'block';
        loadCategoryList();
        loadUnitList();
    } else {
        settingsSection.style.display = 'none';
    }
}

// Load category list
function loadCategoryList() {
    let categories = getAllCategories();
    let html = '';
    
    categories.forEach(cat => {
        let count = materials.filter(m => m.category === cat).length;
        html += `
            <div>
                <span><strong>${cat}</strong> (${count} items)</span>
                <div>
                    <button onclick="editCategory('${cat}')" class="edit-cat-btn">✏️ Edit</button>
                    <button onclick="deleteCategory('${cat}')" class="delete-cat-btn">✗</button>
                </div>
            </div>
        `;
    });
    
    document.getElementById('categoryList').innerHTML = html || '<p style="color: #666; text-align: center;">No categories yet</p>';
}

// Load unit list
function loadUnitList() {
    let units = getAllUnits();
    let html = '';
    
    units.forEach(unit => {
        let count = materials.filter(m => m.unit === unit).length;
        html += `
            <div>
                <span><strong>${unit}</strong> (${count} items)</span>
                <div>
                    <button onclick="editUnit('${unit}')" class="edit-unit-btn">✏️ Edit</button>
                    <button onclick="deleteUnit('${unit}')" class="delete-unit-btn">✗</button>
                </div>
            </div>
        `;
    });
    
    document.getElementById('unitList').innerHTML = html || '<p style="color: #666; text-align: center;">No units yet</p>';
}

// Get all unique categories
function getAllCategories() {
    let cats = new Set();
    materials.forEach(m => {
        if (m && m.category) {
            cats.add(m.category);
        }
    });
    return Array.from(cats).sort();
}

// Get all unique units
function getAllUnits() {
    let units = new Set();
    materials.forEach(m => {
        if (m && m.unit) {
            units.add(m.unit);
        }
    });
    return Array.from(units).sort();
}

// Add new category
function addNewCategory() {
    let newCat = document.getElementById('newCategoryName').value.trim();
    if (!newCat) {
        alert('Please enter a category name');
        return;
    }
    
    // Capitalize first letter
    newCat = newCat.charAt(0).toUpperCase() + newCat.slice(1).toLowerCase();
    
    // Check if exists
    let exists = materials.some(m => m.category.toLowerCase() === newCat.toLowerCase());
    if (exists) {
        alert('Category already exists');
        return;
    }
    
    let id = generateRandomId();
    while (materials.some(m => m && m.code === id)) {
        id = generateRandomId();
    }
     let newMaterial = {
        id: Date.now(),
        code: id,
        name: `[New Category] ${newCat}`,   // easily identifiable
        category: newCat,
        stock: 0,
        unit: 'pieces',
        remarks: 'Placeholder – you can rename or delete this item.'
    };

    materials.push(newMaterial);
    saveMaterials();

    // (Optional) record activity
    activities.unshift({
        id: Date.now(),
        action: 'ADD',
        material_code: id,
        material_name: newMaterial.name,
        quantity: 0,
        timestamp: new Date().toLocaleString()
    });
    saveActivities();

    document.getElementById('newCategoryName').value = '';
    loadCategoryList();
    updateCategoryFilter();
    updateTable();

    alert(`✅ Category "${newCat}" added`);
}

// Add new unit
function addNewUnit() {
    let newUnit = document.getElementById('newUnitName').value.trim().toLowerCase();
    if (!newUnit) {
        alert('Please enter a unit name');
        return;
    }
    
    // Check if exists
    let exists = getAllUnits().some(u => u.toLowerCase() === newUnit.toLowerCase());
    if (exists) {
        alert('Unit already exists');
        return;
    }
    
    document.getElementById('newUnitName').value = '';
    loadUnitList();
    alert(`✅ Unit "${newUnit}" added`);
}

// Edit category
function editCategory(oldCat) {
    let newCat = prompt('Edit category name:', oldCat);
    if (!newCat || newCat === oldCat) return;
    
    newCat = newCat.charAt(0).toUpperCase() + newCat.slice(1).toLowerCase();
    
    // Check if new name exists
    let exists = getAllCategories().some(c => c.toLowerCase() === newCat.toLowerCase() && c !== oldCat);
    if (exists) {
        alert('Category name already exists');
        return;
    }
    
    // Update all materials
    materials = materials.map(m => {
        if (m && m.category === oldCat) {
            m.category = newCat;
        }
        return m;
    });
    
    saveMaterials();
    updateTable();
    updateCategoryFilter();
    loadCategoryList();
    alert(`✅ Category updated: ${oldCat} → ${newCat}`);
}

// Edit unit
function editUnit(oldUnit) {
    let newUnit = prompt('Edit unit name:', oldUnit);
    if (!newUnit || newUnit === oldUnit) return;
    
    newUnit = newUnit.toLowerCase();
    
    // Check if new name exists
    let exists = getAllUnits().some(u => u.toLowerCase() === newUnit.toLowerCase() && u !== oldUnit);
    if (exists) {
        alert('Unit name already exists');
        return;
    }
    
    // Update all materials
    materials = materials.map(m => {
        if (m && m.unit === oldUnit) {
            m.unit = newUnit;
        }
        return m;
    });
    
    saveMaterials();
    updateTable();
    loadUnitList();
    alert(`✅ Unit updated: ${oldUnit} → ${newUnit}`);
}

// Delete category
function deleteCategory(cat) {
    let count = materials.filter(m => m.category === cat).length;
    
    if (count > 0) {
        if (!confirm(`⚠️ Category "${cat}" is used by ${count} material(s).\n\nReassign these materials to another category?`)) {
            return;
        }
        
        // Get all other categories
        let otherCats = getAllCategories().filter(c => c !== cat);
        if (otherCats.length === 0) {
            alert('No other categories to reassign to');
            return;
        }
        
        // Ask which category to reassign to
        let catList = otherCats.map((c, i) => `${i+1}. ${c}`).join('\n');
        let choice = prompt(`Reassign to which category?\n\n${catList}\n\nEnter category name:`);
        
        if (!choice) return;
        
        // Find matching category
        let targetCat = otherCats.find(c => c.toLowerCase() === choice.toLowerCase());
        if (!targetCat) {
            alert('Category not found');
            return;
        }
        
        // Reassign all materials
        materials = materials.map(m => {
            if (m && m.category === cat) {
                m.category = targetCat;
            }
            return m;
        });
        
        saveMaterials();
        updateTable();
        updateCategoryFilter();
        loadCategoryList();
        alert(`✅ Items reassigned to "${targetCat}"`);
    } else {
        if (confirm(`Delete category "${cat}"?`)) {
            loadCategoryList();
            alert(`✅ Category "${cat}" deleted`);
        }
    }
}

// Delete unit
function deleteUnit(unit) {
    let count = materials.filter(m => m.unit === unit).length;
    
    if (count > 0) {
        alert(`⚠️ Cannot delete "${unit}" because it is used by ${count} material(s).`);
    } else {
        if (confirm(`Delete unit "${unit}"?`)) {
            loadUnitList();
            alert(`✅ Unit "${unit}" deleted`);
        }
    }
}


// ==================== GLOBAL FUNCTIONS ====================

window.showAddForm = showAddForm;
window.showReceiveForm = showReceiveForm;
window.showIssueForm = showIssueForm;
window.showCountForm = showCountForm;
window.saveNewMaterial = saveNewMaterial;
window.saveBulkMaterials = saveBulkMaterials;
window.addMaterialRow = addMaterialRow;
window.removeMaterialRow = removeMaterialRow;
window.saveReceive = saveReceive;
window.saveIssue = saveIssue;
window.saveCount = saveCount;
window.deleteMaterial = deleteMaterial;
window.selectMaterial = selectMaterial;
window.searchMaterial = searchMaterial;
window.filterMaterials = filterMaterials;
window.printSingleBarcode = printSingleBarcode;
window.closeBarcodeModal = closeBarcodeModal;
window.printBarcodeLabel = printBarcodeLabel;
window.hideAllForms = hideAllForms;
window.toggleCamera = toggleCamera;
window.closeSelectedMaterial = closeSelectedMaterial;
window.toggleSettings = toggleSettings;
window.addNewCategory = addNewCategory;
window.addNewUnit = addNewUnit;
window.editCategory = editCategory;
window.editUnit = editUnit;
window.deleteCategory = deleteCategory;
window.deleteUnit = deleteUnit;

// ==================== REPAIR EXISTING DATA ====================
function repairData() {
    console.log('🔧 Repairing data...');
    let repaired = false;
    
    materials = materials.map(m => {
        let needsFix = false;
        let fixed = { ...m };
        
        // Add missing fields with defaults
        if (!fixed.code) {
            fixed.code = Math.floor(1 + Math.random() * 999).toString();
            }
        if (!fixed.name) fixed.name = 'Unknown', needsFix = true;
        if (!fixed.category) fixed.category = 'Steel', needsFix = true;
        if (fixed.stock === undefined || fixed.stock === null) fixed.stock = 0, needsFix = true;
        if (!fixed.unit) fixed.unit = 'pieces', needsFix = true;
        
        if (needsFix) repaired = true;
        return fixed;
    });
    
    if (repaired) {
        saveMaterials();
        console.log('✅ Data repaired');
        updateTable();
        updateStats();
    }
}

// Add repair to initialization
const originalInit = initDatabase;
initDatabase = function() {
    originalInit();
    setTimeout(repairData, 500); // Repair after loading
};