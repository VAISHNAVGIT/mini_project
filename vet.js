import { database, ref, onValue, update, checkAuth } from './firebase-config.js';

// Verify Role - Only Veterinarians allowed
checkAuth(['veterinarian']);

const cattleRef = ref(database, 'cattle');
const sensorRef = ref(database, 'sensorData');
let currentCattleList = {};

// ====== LEAFLET MAP SETUP ======
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO'
}).addTo(map);

const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style='background-color:#38bdf8;width:16px;height:16px;border-radius:50%;border:3px solid #0d1117;box-shadow:0 0 10px #38bdf8;'></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});
const marker = L.marker([0, 0], {icon: customIcon}).addTo(map);

// ====== LIVE SENSOR DATA LOGIC ======
const UI = {
    bpmVal: document.getElementById('bpmVal'),
    tempVal: document.getElementById('tempVal'),
    stepsVal: document.getElementById('stepsVal'),
    locVal: document.getElementById('locVal')
};

onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if(data) {
        if(UI.bpmVal) UI.bpmVal.textContent = data.bpm !== undefined ? data.bpm : '--';
        if(UI.tempVal) UI.tempVal.textContent = data.temp !== undefined ? parseFloat(data.temp).toFixed(1) : '--';
        if(UI.stepsVal) UI.stepsVal.textContent = data.steps !== undefined ? data.steps : '--';

        if (data.temp !== undefined && parseFloat(data.temp) > 35) {
            if (window.showGlobalNotification) window.showGlobalNotification(`Cattle Temperature Alert: ${parseFloat(data.temp).toFixed(1)}°C`);
        } else {
            if (window.hideGlobalNotification) window.hideGlobalNotification();
        }

        if (data.lat && data.lng && data.lat !== 0) {
            const pos = [data.lat, data.lng];
            marker.setLatLng(pos);
            map.setView(pos, 16);
            if(UI.locVal) UI.locVal.textContent = `${parseFloat(data.lat).toFixed(5)}, ${parseFloat(data.lng).toFixed(5)}`;
        } else {
            if(UI.locVal) UI.locVal.textContent = 'Awaiting valid GPS Fix...';
        }
    }
});

// ====== CATTLE DATA LOGIC ======
onValue(cattleRef, (snapshot) => {
    currentCattleList = snapshot.val() || {};
    renderVetTable();
});

function renderVetTable() {
    const tbody = document.getElementById('vetTableBody');
    tbody.innerHTML = '';
    
    Object.keys(currentCattleList).forEach(id => {
        const c = currentCattleList[id];
        const tr = document.createElement('tr');
        
        let statusColor = 'safe';
        const health = (c.healthStatus || 'Good').toLowerCase();
        if(health === 'critical' || health === 'sick') statusColor = 'danger';
        else if(health === 'fair') statusColor = 'warning';

        tr.innerHTML = `
            <td>${id}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.age}</td>
            <td>${c.dob}</td>
            <td><span class="alert-status ${statusColor}" style="padding:0.2rem 0.5rem; color:#fff;">${c.healthStatus || 'Good'}</span></td>
            <td>${c.lastCheckup || '--'}</td>
            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.vetMessage || '--'}</td>
            <td>
                <button class="action-btn" onclick="openMedicalPanel('${id}')">Record Diagnosis</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Bind to window so inline onclick handlers in the HTML can reach this function.
window.openMedicalPanel = function(id) {
    const c = currentCattleList[id];
    if(!c) return;

    // Reveal form
    const form = document.getElementById('vetForm');
    form.style.display = 'block';

    // Populate data
    document.getElementById('editCattleId').value = id;
    document.getElementById('cId').value = id;
    document.getElementById('cName').value = c.name || 'Unknown';
    
    // Select correct option or fallback to Good if empty
    const statusSelect = document.getElementById('cHealth');
    let found = false;
    if (c.healthStatus) {
        for (let i = 0; i < statusSelect.options.length; i++) {
            if (statusSelect.options[i].value.toLowerCase() === c.healthStatus.toLowerCase()) {
                statusSelect.selectedIndex = i;
                found = true;
                break;
            }
        }
    }
    if (!found) statusSelect.value = "Good";

    document.getElementById('cCheckup').value = c.lastCheckup || '';
    document.getElementById('cMedical').value = c.medicalHistory || '';
    document.getElementById('cVetMsg').value = c.vetMessage || '';

    // Scroll to form nicely
    window.scrollTo({ top: form.offsetTop - 50, behavior: 'smooth' });
};

// Handle Update Submission
const vetForm = document.getElementById('vetForm');
vetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editCattleId').value;
    
    // Only medical data corresponds to Vet modifications (prevent them overwriting name/age bounds blindly)
    const updateData = {
        healthStatus: document.getElementById('cHealth').value,
        lastCheckup: document.getElementById('cCheckup').value,
        medicalHistory: document.getElementById('cMedical').value,
        vetMessage: document.getElementById('cVetMsg').value
    };

    update(ref(database, `cattle/${id}`), updateData)
    .then(() => {
        alert('Medical Record successfully published to the database!');
        vetForm.style.display = 'none'; // hide form post-update
    })
    .catch((error) => {
        console.error("Firebase Update Failed:", error);
        alert('Failed to publish. Check connection.');
    });
});
