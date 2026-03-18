import { database, ref, onValue, set, update, remove, push, checkAuth } from './firebase-config.js';

// Verify Role
checkAuth(['admin']);

const sensorRef = ref(database, 'sensorData');
const farmRef = ref(database, 'farmData');
const cattleRef = ref(database, 'cattle');

// UI Bindings (Sensors)
const UI = {
    bpmVal: document.getElementById('bpmVal'),
    tempVal: document.getElementById('tempVal'),
    stepsVal: document.getElementById('stepsVal'),
    inputWater: document.getElementById('inputWater'),
    inputFood: document.getElementById('inputFood'),
    btnUpdateWater: document.getElementById('btnUpdateWater'),
    btnUpdateFood: document.getElementById('btnUpdateFood'),
    connStatusText: document.getElementById('connStatus').childNodes[2],
    connDot: document.querySelector('.pulsing-dot'),
};

// Start listening for Live Sensors
onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if(data) {
        UI.connStatusText.textContent = ' Connected (Live)';
        UI.connDot.className = 'pulsing-dot active';
        UI.bpmVal.textContent = data.bpm !== undefined ? data.bpm : '--';
        UI.tempVal.textContent = data.temp !== undefined ? parseFloat(data.temp).toFixed(1) : '--';
        UI.stepsVal.textContent = data.steps !== undefined ? data.steps : '--';

        if (data.temp !== undefined && parseFloat(data.temp) > 35) {
            if (window.showGlobalNotification) window.showGlobalNotification(`Cattle Temperature Alert: ${parseFloat(data.temp).toFixed(1)}°C`);
        } else {
            if (window.hideGlobalNotification) window.hideGlobalNotification();
        }
    }
});

// Sync Inputs for Farm Data
onValue(farmRef, (snapshot) => {
    const data = snapshot.val();
    if(data) {
        if(data.waterLevel !== undefined) {
            UI.inputWater.placeholder = `Current: ${data.waterLevel}%`;
        }
        if(data.foodLevel !== undefined) {
            UI.inputFood.placeholder = `Current: ${data.foodLevel}kg`;
        }
    }
});

// Update Farm Data Action
UI.btnUpdateWater.addEventListener('click', () => {
    if(!UI.inputWater.value) return;
    update(farmRef, { waterLevel: parseFloat(UI.inputWater.value) })
    .then(() => { UI.inputWater.value = ''; alert('Water capacity updated!'); });
});

UI.btnUpdateFood.addEventListener('click', () => {
    if(!UI.inputFood.value) return;
    update(farmRef, { foodLevel: parseFloat(UI.inputFood.value) })
    .then(() => { UI.inputFood.value = ''; alert('Food capacity updated!'); });
});

// ====== CATTLE DATABASE LOGIC ======
const cattleForm = document.getElementById('cattleForm');
let currentCattleList = {};

onValue(cattleRef, (snapshot) => {
    currentCattleList = snapshot.val() || {};
    renderCattleTable();
});

function renderCattleTable() {
    const tbody = document.getElementById('cattleTableBody');
    tbody.innerHTML = '';
    
    Object.keys(currentCattleList).forEach(id => {
        const c = currentCattleList[id];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${id}</td>
            <td>${c.name}</td>
            <td>${c.age}</td>
            <td>${c.dob}</td>
            <td><span class="alert-status ${c.healthStatus && c.healthStatus.toLowerCase() === 'good' ? 'safe' : 'danger'}" style="padding:0.2rem 0.5rem;">${c.healthStatus}</span></td>
            <td>${c.lastCheckup}</td>
            <td>
                <button class="action-btn" onclick="editCattle('${id}')">Edit</button>
                <button class="action-btn del" onclick="deleteCattle('${id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Bind to window for onclick handlers
window.editCattle = function(id) {
    const c = currentCattleList[id];
    if(!c) return;
    document.getElementById('editCattleId').value = id;
    document.getElementById('cId').value = id;
    document.getElementById('cId').disabled = true; // Cannot edit ID of existing
    document.getElementById('cName').value = c.name;
    document.getElementById('cAge').value = c.age;
    document.getElementById('cDob').value = c.dob;
    document.getElementById('cHealth').value = c.healthStatus;
    document.getElementById('cCheckup').value = c.lastCheckup;
    document.getElementById('cMedical').value = c.medicalHistory;
    document.getElementById('cVetMsg').value = c.vetMessage || '';
    window.scrollTo({ top: document.getElementById('cattleForm').offsetTop - 50, behavior: 'smooth' });
};

window.deleteCattle = function(id) {
    if(confirm(`Are you sure you want to permanently delete cattle ${id}?`)) {
        remove(ref(database, `cattle/${id}`));
    }
};

document.getElementById('btnClearCattle').addEventListener('click', () => {
    document.getElementById('editCattleId').value = '';
    cattleForm.reset();
    document.getElementById('cId').disabled = false;
});

cattleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('cId').value;
    const isEdit = document.getElementById('editCattleId').value;

    const data = {
        name: document.getElementById('cName').value,
        age: document.getElementById('cAge').value,
        dob: document.getElementById('cDob').value,
        healthStatus: document.getElementById('cHealth').value,
        lastCheckup: document.getElementById('cCheckup').value,
        medicalHistory: document.getElementById('cMedical').value
    };

    if (isEdit) {
        // Only update fields the admin handles, preserve vetMessage
        update(ref(database, `cattle/${id}`), data)
        .then(() => {
            alert('Cattle Updated!');
            document.getElementById('btnClearCattle').click();
        });
    } else {
        // Create new
        data.vetMessage = ''; // initialize empty
        set(ref(database, `cattle/${id}`), data)
        .then(() => {
            alert('New Cattle Added!');
            document.getElementById('btnClearCattle').click();
        });
    }
});

// ====== FARMER INSTRUCTIONS LOGIC ======
const instructionsRef = ref(database, 'instructions');
const inputInstruction = document.getElementById('inputInstruction');
const btnAddInstruction = document.getElementById('btnAddInstruction');
const adminInstructionsList = document.getElementById('adminInstructionsList');

onValue(instructionsRef, (snapshot) => {
    if (!adminInstructionsList) return;
    adminInstructionsList.innerHTML = '';
    const data = snapshot.val();
    if(data) {
        Object.keys(data).forEach(id => {
            const item = data[id];
            const div = document.createElement('div');
            div.className = `check-item ${item.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <div class="check-item-text">${item.text}</div>
                <button type="button" class="delete-instruction-btn" onclick="deleteInstruction('${id}')" title="Delete Task">&times;</button>
            `;
            adminInstructionsList.appendChild(div);
        });
    } else {
        adminInstructionsList.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem; padding: 0.5rem;">No active instructions.</p>';
    }
});

if (btnAddInstruction) {
    btnAddInstruction.addEventListener('click', () => {
        const text = inputInstruction.value.trim();
        if (text) {
            const newRef = push(instructionsRef);
            set(newRef, {
                text: text,
                completed: false,
                timestamp: Date.now()
            }).then(() => {
                inputInstruction.value = '';
            });
        }
    });

    if (inputInstruction) {
        inputInstruction.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnAddInstruction.click();
            }
        });
    }
}

window.deleteInstruction = function(id) {
    if(confirm("Delete this instruction?")) {
        remove(ref(database, `instructions/${id}`));
    }
};
