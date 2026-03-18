import { database, ref, onValue, update, checkAuth } from './firebase-config.js';

// Verify Role
checkAuth(['farmer']);

const sensorRef = ref(database, 'sensorData');
const farmRef = ref(database, 'farmData');

// ====== LEAFLET MAP SETUP ======
const map = L.map('map').setView([0, 0], 2);
// Use dark tile layer for better matching with dark mode theme
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO'
}).addTo(map);

// Custom SVG icon for marker
const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style='background-color:#38bdf8;width:16px;height:16px;border-radius:50%;border:3px solid #0d1117;box-shadow:0 0 10px #38bdf8;'></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});
const marker = L.marker([0, 0], {icon: customIcon}).addTo(map);

// ====== UI UPDATE LOGIC ======
const UI = {
    bpmVal: document.getElementById('bpmVal'),
    tempVal: document.getElementById('tempVal'),
    stepsVal: document.getElementById('stepsVal'),
    locVal: document.getElementById('locVal'),
    tempAlert: document.getElementById('tempAlert'),
    tempCard: document.getElementById('tempCard'),
    stepsFill: document.getElementById('stepsFill'),
    connStatusText: document.getElementById('connStatus').childNodes[2],
    connDot: document.querySelector('.pulsing-dot'),
};

// Target constraints
const TARGET_STEPS = 10000;
const MAX_WATER = 100; // 100%
const MAX_FOOD = 500;  // 500kg

// UI Bindings Extension
UI.waterVal = document.getElementById('waterVal');
UI.waterFill = document.getElementById('waterFill');
UI.foodVal = document.getElementById('foodVal');
UI.foodFill = document.getElementById('foodFill');

// Listen for Farm Data (Food & Water)
onValue(farmRef, (snapshot) => {
    const data = snapshot.val();
    if(data) {
        if(data.waterLevel !== undefined) {
             UI.waterVal.textContent = data.waterLevel;
             UI.waterFill.style.width = `${Math.min((data.waterLevel / MAX_WATER) * 100, 100)}%`;
        }
        if(data.foodLevel !== undefined) {
             UI.foodVal.textContent = data.foodLevel;
             UI.foodFill.style.width = `${Math.min((data.foodLevel / MAX_FOOD) * 100, 100)}%`;
        }
    }
});

// Listen for Sensor data realtime
onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if(data) {
        // Update connection status
        UI.connStatusText.textContent = ' Connected (Live)';
        UI.connDot.className = 'pulsing-dot active';

        // 1. Update BPM
        if (UI.bpmVal) UI.bpmVal.textContent = data.bpm !== undefined ? data.bpm : '--';
        
        // 2. Update Temperature & Alerts
        if (data.temp !== undefined) {
             const tempF = parseFloat(data.temp).toFixed(1);
             if (UI.tempVal) UI.tempVal.textContent = tempF;
             
             if (parseFloat(tempF) > 35) {
                 if (UI.tempAlert) {
                     UI.tempAlert.textContent = 'High Fever Alert';
                     UI.tempAlert.className = 'alert-status danger';
                 }
                 if (window.showGlobalNotification) window.showGlobalNotification(`Cattle Temperature Alert: ${tempF}°C`);
             } else {
                 if (UI.tempAlert) {
                     UI.tempAlert.textContent = 'Normal';
                     UI.tempAlert.className = 'alert-status safe';
                 }
                 if (window.hideGlobalNotification) window.hideGlobalNotification();
             }
        }

        // 3. Update Steps
        if (data.steps !== undefined && UI.stepsVal) {
             UI.stepsVal.textContent = data.steps;
             let progress = (data.steps / TARGET_STEPS) * 100;
             if (progress > 100) progress = 100;
             if (UI.stepsFill) UI.stepsFill.style.width = `${progress}%`;
        }
        
        // 4. Update GPS Map
        if (data.lat && data.lng && data.lat !== 0) {
            const pos = [data.lat, data.lng];
            marker.setLatLng(pos);
            map.setView(pos, 16);
            UI.locVal.textContent = `${parseFloat(data.lat).toFixed(5)}, ${parseFloat(data.lng).toFixed(5)}`;
        } else {
            UI.locVal.textContent = 'Awaiting valid GPS Fix...';
        }
    }
}, (error) => {
    console.error("Firebase read failed:", error);
    UI.connStatusText.textContent = ' Connection Error';
    UI.connDot.className = 'pulsing-dot warning';
    UI.connDot.style.background = '#ef4444';
    UI.connDot.style.boxShadow = '0 0 10px #ef4444';
});

// ====== FARMER INSTRUCTIONS CHECKLIST LOGIC ======
const instructionsRef = ref(database, 'instructions');
const instructionsList = document.getElementById('instructionsList');

onValue(instructionsRef, (snapshot) => {
    if (!instructionsList) return;
    instructionsList.innerHTML = '';
    const data = snapshot.val();
    if(data) {
        // Sort with uncompleted first, then completed.
        const items = Object.keys(data).map(id => ({ id, ...data[id] }));
        items.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.timestamp - b.timestamp;
        });

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = `check-item ${item.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleInstruction('${item.id}', this.checked)">
                <div class="check-item-text">${item.text}</div>
            `;
            instructionsList.appendChild(div);
        });
    } else {
        instructionsList.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem; padding: 0.5rem;">No pending instructions from admin.</p>';
    }
});

window.toggleInstruction = function(id, isCompleted) {
    update(ref(database, `instructions/${id}`), {
        completed: isCompleted
    });
};
