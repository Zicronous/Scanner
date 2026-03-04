// ==================== SQLITE DATABASE SETUP ====================
let db = null;
let SQL = null;
let materials = [];
let selectedMaterial = null;
let scanBuffer = "";
let lastKeyTime = 0;
let html5QrcodeScanner = null;
let isScanning = false;

// Initialize database
async function initDatabase() {
    try {
        // Load SQL.js
        SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        
        // Try to load existing database from localStorage
        let savedDb = localStorage.getItem('inventory_db');
        if (savedDb) {
            // Load existing database
            let dataArray = new Uint8Array(JSON.parse(savedDb));
            db = new SQL.Database(dataArray);
            console.log('✅ Loaded existing database');
        } else {
            // Create new database
            db = new SQL.Database();
            createTables();
            console.log('✅ Created new database');
        }
        
        loadMaterials();
        
    } catch (error) {
        console.error('Database init error:', error);
    }
}

// Create tables
function createTables() {
    // Materials table
    db.run(`
        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            stock INTEGER DEFAULT 0,
            unit TEXT DEFAULT 'pieces',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Activities table (history)
    db.run(`
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            material_code TEXT,
            material_name TEXT,
            quantity INTEGER,
            old_stock INTEGER,
            new_stock INTEGER,
            note TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (material_code) REFERENCES materials(code)
        )
    `);
    
    // Create indexes for performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category)`);
    
    // Enable WAL mode for better concurrency
    db.run(`PRAGMA journal_mode=WAL;`);
    
    saveDatabase();
}

// Save database to localStorage
function saveDatabase() {
    if (!db) return;
    
    // Export database as binary
    let data = db.export();
    let buffer = new Uint8Array(data);
    let dataStr = JSON.stringify(Array.from(buffer));
    localStorage.setItem('inventory_db', dataStr);
}

// Load all materials
function loadMaterials() {
    if (!db) return;
    
    try {
        let results = db.exec(`
            SELECT id, code, name, category, stock, unit 
            FROM materials 
            ORDER BY code
        `);
        
        if (results.length > 0) {
            materials = results[0].values.map(row => ({
                id: row[0],
                code: row[1],
                name: row[2],
                category: row[3],
                stock: row[4],
                unit: row[5]
            }));
        } else {
            materials = [];
        }
        
        updateTable();
        updateStats();
        
    } catch (error) {
        console.error('Error loading materials:', error);
        materials = [];
    }
}

// ==================== CORE FUNCTIONS ====================

// Generate code from name
function generateCode(name, category) {
    let cat = category.substring(0, 2).toUpperCase();
    let words = name.split(' ');
    let codePart = '';
    
    if (words.length > 1) {
        codePart = words[0][0] + words[1].substring(0, 2);
    } else {
        codePart = name.substring(0, 3);
    }
    
    let numbers = name.match(/\d+/g);
    let numPart = numbers ? numbers[0] : '';
    
    return `${cat}-${codePart.toUpperCase()}${numPart}`;
}

// Get stock status
function getStockStatus(stock) {
    if (stock <= 5) return 'Critical';
    if (stock <= 20) return 'Low';
    return 'OK';
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
    let filtered = filter === 'ALL' ? materials : materials.filter(m => m.category === filter);
    
    if (filtered.length === 0) {
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
        let status = getStockStatus(m.stock);
        let statusClass = status === 'Critical' ? 'status-critical' : 
                         status === 'Low' ? 'status-low' : 'status-ok';
        
        html += `
            <tr>
                <td><strong>${m.code}</strong></td>
                <td>${m.name}</td>
                <td>${m.category}</td>
                <td>${m.stock}</td>
                <td>${m.unit}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button onclick="selectMaterial('${m.code}')" class="action-btn edit-btn">View</button>
                        <button onclick="printSingleBarcode('${m.code}', '${m.name}')" class="action-btn print-btn">🖨️</button>
                        <button onclick="deleteMaterial('${m.code}')" class="action-btn delete-btn">✗</button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    document.getElementById('tableBody').innerHTML = html;
}

// Filter materials
function filterMaterials() {
    updateTable();
}

// Search material
function searchMaterial(barcode) {
    let searchTerm = barcode || document.getElementById('searchInput').value.trim().toUpperCase();
    
    if (!searchTerm) return;
    
    let material = materials.find(m => m.code.toUpperCase() === searchTerm);
    
    if (material) {
        selectMaterial(material.code);
    } else {
        material = materials.find(m => m.name.toUpperCase().includes(searchTerm));
        if (material) {
            selectMaterial(material.code);
        } else {
            if (confirm(`Material not found: ${searchTerm}\n\nAdd as new material?`)) {
                document.getElementById('newName').value = searchTerm;
                showAddForm();
            }
        }
    }
}

// Select material
// REPLACE your existing selectMaterial function with this:
function selectMaterial(code) {
    let material = materials.find(m => m.code === code);
    if (!material) return;
    
    selectedMaterial = material;
    
    let status = getStockStatus(material.stock);
    let statusClass = status === 'Critical' ? 'status-critical' : 
                      status === 'Low' ? 'status-low' : 'status-ok';
    
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
                <div class="detail-label">Status</div>
                <div class="detail-value ${statusClass}">${status}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Last Updated</div>
                <div class="detail-value">${new Date().toLocaleDateString()}</div>
            </div>
        </div>
        <div class="material-actions">
            <button onclick="showReceiveForm('${material.code}')" class="btn-receive">📦 Receive</button>
            <button onclick="showIssueForm('${material.code}')" class="btn-issue">🏭 Issue</button>
            <button onclick="showCountForm('${material.code}')" class="btn-count">📊 Count</button>
            <button onclick="printSingleBarcode('${material.code}', '${material.name}')" class="btn-print">🖨️ Print Label</button>
            <button onclick="deleteMaterial('${material.code}')" class="btn-delete">🗑️ Delete</button>
        </div>
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
}

function showAddForm() {
    hideAllForms();
    document.getElementById('addForm').classList.remove('hidden');
    document.getElementById('newName').focus();
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
}

function showCountForm(materialCode) {
    hideAllForms();
    let material = materials.find(m => m.code === materialCode);
    if (!material) return;
    
    document.getElementById('countMaterialInfo').innerHTML = 
        `<strong>${material.name}</strong> (${material.code})<br>System Stock: ${material.stock} ${material.unit}`;
    document.getElementById('countForm').dataset.code = material.code;
    document.getElementById('countForm').classList.remove('hidden');
    document.getElementById('countQty').focus();
}

// ==================== CRUD OPERATIONS ====================

// Add new material
function saveNewMaterial() {
    let name = document.getElementById('newName').value.trim();
    let category = document.getElementById('newCategory').value;
    let unit = document.getElementById('newUnit').value.trim() || 'pieces';
    let stock = parseInt(document.getElementById('newStock').value) || 0;
    
    if (!name) {
        alert('Material name is required');
        return;
    }
    
    // Generate code
    let code = generateCode(name, category);
    
    try {
        // Check if code exists
        let check = db.exec(`SELECT code FROM materials WHERE code = ?`, [code]);
        if (check.length > 0 && check[0].values.length > 0) {
            // Make code unique
            let counter = 1;
            while (true) {
                let newCode = `${code}-${counter}`;
                check = db.exec(`SELECT code FROM materials WHERE code = ?`, [newCode]);
                if (check.length === 0 || check[0].values.length === 0) {
                    code = newCode;
                    break;
                }
                counter++;
            }
        }
        
        // Insert new material
        db.run(`
            INSERT INTO materials (code, name, category, stock, unit) 
            VALUES (?, ?, ?, ?, ?)
        `, [code, name, category, stock, unit]);
        
        // Log activity
        db.run(`
            INSERT INTO activities (action, material_code, material_name, quantity, new_stock) 
            VALUES (?, ?, ?, ?, ?)
        `, ['ADD', code, name, stock, stock]);
        
        saveDatabase();
        loadMaterials();
        hideAllForms();
        
        // Select the new material
        selectMaterial(code);
        
        alert(`✅ Material added!\nCode: ${code}`);
        
        // Clear form
        document.getElementById('newName').value = '';
        document.getElementById('newStock').value = '0';
        
    } catch (error) {
        console.error('Error adding material:', error);
        alert('❌ Error adding material');
    }
}

// Receive stock
function saveReceive() {
    let code = document.getElementById('receiveForm').dataset.code;
    let qty = parseInt(document.getElementById('receiveQty').value);
    let note = document.getElementById('receiveNote').value;
    
    if (!qty || qty < 1) {
        alert('Enter valid quantity');
        return;
    }
    
    try {
        db.run(`BEGIN TRANSACTION;`);
        
        // Get current stock
        let result = db.exec(`SELECT stock, name FROM materials WHERE code = ?`, [code]);
        if (result.length === 0 || result[0].values.length === 0) {
            throw new Error('Material not found');
        }
        
        let currentStock = result[0].values[0][0];
        let name = result[0].values[0][1];
        let newStock = currentStock + qty;
        
        // Update stock
        db.run(`
            UPDATE materials 
            SET stock = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE code = ?
        `, [newStock, code]);
        
        // Log activity
        db.run(`
            INSERT INTO activities 
            (action, material_code, material_name, quantity, old_stock, new_stock, note) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['RECEIVE', code, name, qty, currentStock, newStock, note]);
        
        db.run(`COMMIT;`);
        
        saveDatabase();
        loadMaterials();
        selectMaterial(code);
        hideAllForms();
        
        document.getElementById('receiveQty').value = '';
        document.getElementById('receiveNote').value = '';
        
        alert(`✅ Received ${qty} ${name}\nNew stock: ${newStock}`);
        
    } catch (error) {
        db.run(`ROLLBACK;`);
        console.error('Error receiving stock:', error);
        alert('❌ Error receiving stock');
    }
}

// Issue stock
function saveIssue() {
    let code = document.getElementById('issueForm').dataset.code;
    let qty = parseInt(document.getElementById('issueQty').value);
    let note = document.getElementById('issueNote').value;
    
    if (!qty || qty < 1) {
        alert('Enter valid quantity');
        return;
    }
    
    try {
        db.run(`BEGIN TRANSACTION;`);
        
        // Get current stock
        let result = db.exec(`SELECT stock, name FROM materials WHERE code = ?`, [code]);
        if (result.length === 0 || result[0].values.length === 0) {
            throw new Error('Material not found');
        }
        
        let currentStock = result[0].values[0][0];
        let name = result[0].values[0][1];
        
        if (currentStock < qty) {
            db.run(`ROLLBACK;`);
            alert(`❌ Only ${currentStock} available!`);
            return;
        }
        
        let newStock = currentStock - qty;
        
        // Update stock
        db.run(`
            UPDATE materials 
            SET stock = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE code = ?
        `, [newStock, code]);
        
        // Log activity
        db.run(`
            INSERT INTO activities 
            (action, material_code, material_name, quantity, old_stock, new_stock, note) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['ISSUE', code, name, qty, currentStock, newStock, note]);
        
        db.run(`COMMIT;`);
        
        saveDatabase();
        loadMaterials();
        selectMaterial(code);
        hideAllForms();
        
        document.getElementById('issueQty').value = '';
        document.getElementById('issueNote').value = '';
        
        alert(`✅ Issued ${qty} ${name}\nNew stock: ${newStock}`);
        
    } catch (error) {
        db.run(`ROLLBACK;`);
        console.error('Error issuing stock:', error);
        alert('❌ Error issuing stock');
    }
}

// Stock count adjustment
function saveCount() {
    let code = document.getElementById('countForm').dataset.code;
    let actual = parseInt(document.getElementById('countQty').value);
    let reason = document.getElementById('countReason').value;
    
    if (isNaN(actual) || actual < 0) {
        alert('Enter valid quantity');
        return;
    }
    
    try {
        db.run(`BEGIN TRANSACTION;`);
        
        // Get current stock
        let result = db.exec(`SELECT stock, name FROM materials WHERE code = ?`, [code]);
        if (result.length === 0 || result[0].values.length === 0) {
            throw new Error('Material not found');
        }
        
        let currentStock = result[0].values[0][0];
        let name = result[0].values[0][1];
        let difference = actual - currentStock;
        
        // Update stock
        db.run(`
            UPDATE materials 
            SET stock = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE code = ?
        `, [actual, code]);
        
        // Log activity
        db.run(`
            INSERT INTO activities 
            (action, material_code, material_name, quantity, old_stock, new_stock, note) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['COUNT', code, name, difference, currentStock, actual, reason]);
        
        db.run(`COMMIT;`);
        
        saveDatabase();
        loadMaterials();
        selectMaterial(code);
        hideAllForms();
        
        document.getElementById('countQty').value = '';
        
        alert(`✅ Stock updated\nOld: ${currentStock} → New: ${actual}`);
        
    } catch (error) {
        db.run(`ROLLBACK;`);
        console.error('Error counting stock:', error);
        alert('❌ Error updating count');
    }
}

// Delete material
function deleteMaterial(code) {
    if (!confirm('⚠️ Delete this material? This cannot be undone.')) return;
    
    try {
        db.run(`BEGIN TRANSACTION;`);
        
        // Get material info for logging
        let result = db.exec(`SELECT name FROM materials WHERE code = ?`, [code]);
        let name = result.length > 0 ? result[0].values[0][0] : code;
        
        // Delete activities first
        db.run(`DELETE FROM activities WHERE material_code = ?`, [code]);
        
        // Delete material
        db.run(`DELETE FROM materials WHERE code = ?`, [code]);
        
        db.run(`COMMIT;`);
        
        saveDatabase();
        loadMaterials();
        
        if (selectedMaterial && selectedMaterial.code === code) {
            document.getElementById('selectedMaterial').classList.add('hidden');
            selectedMaterial = null;
        }
        
        alert(`✅ Deleted: ${name}`);
        
    } catch (error) {
        db.run(`ROLLBACK;`);
        console.error('Error deleting material:', error);
        alert('❌ Error deleting material');
    }
}

// ==================== BARCODE FUNCTIONS ====================

function printSingleBarcode(code, name) {
    document.getElementById('barcodePreview').innerHTML = `
        <div style="text-align:center;">
            <img src="https://barcode.tec-it.com/barcode.ashx?data=${code}&code=Code128&dpi=96&imagetype=png" 
                 style="max-width:100%;" alt="Barcode">
            <h4>${code}</h4>
            <p>${name}</p>
        </div>
    `;
    document.getElementById('barcodeModal').classList.remove('hidden');
}

function printBarcode() {
    if (!selectedMaterial) {
        alert('Please select a material first');
        return;
    }
    printSingleBarcode(selectedMaterial.code, selectedMaterial.name);
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
            searchMaterial();
        }
    };
    
    document.getElementById('categoryFilter').onchange = function() {
        filterMaterials();
    };
    
    document.querySelector('.btn-print').onclick = function(e) {
        e.preventDefault();
        printBarcode();
    };
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

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
    initDatabase();
    setupButtonHandlers();
    setupScannerDetection();
    document.getElementById('searchInput').focus();
});

// ==================== GLOBAL FUNCTIONS ====================

window.showAddForm = showAddForm;
window.showReceiveForm = showReceiveForm;
window.showIssueForm = showIssueForm;
window.showCountForm = showCountForm;
window.saveNewMaterial = saveNewMaterial;
window.saveReceive = saveReceive;
window.saveIssue = saveIssue;
window.saveCount = saveCount;
window.deleteMaterial = deleteMaterial;
window.selectMaterial = selectMaterial;
window.searchMaterial = searchMaterial;
window.filterMaterials = filterMaterials;
window.printBarcode = printBarcode;
window.printSingleBarcode = printSingleBarcode;
window.closeBarcodeModal = closeBarcodeModal;
window.printBarcodeLabel = printBarcodeLabel;
window.hideAllForms = hideAllForms;

function toggleCamera() {
    let cameraBtn = document.getElementById('cameraBtn');
    let readerDiv = document.getElementById('reader');
    
    if (!isScanning) {
        readerDiv.style.display = 'block';
        cameraBtn.textContent = '⏹️ Stop Camera';
        cameraBtn.classList.add('active');
        
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        
        html5QrcodeScanner.render(onScanSuccess, onScanError);
        isScanning = true;
    } else {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }
        readerDiv.style.display = 'none';
        cameraBtn.textContent = '📷 Scan with Camera';
        cameraBtn.classList.remove('active');
        isScanning = false;
    }
}

function onScanSuccess(decodedText, decodedResult) {
    toggleCamera();
    document.getElementById('searchInput').value = decodedText;
    searchMaterial(decodedText);
}

function onScanError(errorMessage) {
    // Ignore most errors
}

// ==================== CLOSE SELECTED MATERIAL ====================
function closeSelectedMaterial() {
    document.getElementById('selectedMaterial').classList.add('hidden');
    selectedMaterial = null;
    document.getElementById('searchInput').focus();
}