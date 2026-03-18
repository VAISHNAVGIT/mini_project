#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

// --- Pulse Sensor Config ---
const int pulsePin = 34;
int signalValue = 0;
int threshold = 1800; // Adjust this based on your Serial Plotter
bool beatDetected = false;
unsigned long lastBeatTime = 0;
int bpm = 0;

// Set up for BPM Running Average
const int BPM_SAMPLES = 5;
int bpmHistory[BPM_SAMPLES] = {0, 0, 0, 0, 0};
int bpmIndex = 0;

// --- GPS & Other Sensors ---
TinyGPSPlus gps;
HardwareSerial gpsSerial(2); 

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified();

// --- Variables ---
float latitude = 0, longitude = 0, temperature = 0;
int steps = 0;
float stepThreshold = 12.0;
unsigned long lastStepTime = 0;

// --- WiFi & Firebase Credentials ---
const char* ssid = "AOV";
const char* password = "12345678";
String FIREBASE_URL = "https://mini-project-b629e-default-rtdb.asia-southeast1.firebasedatabase.app/sensorData.json";

WebServer server(80);

void handleRoot() {
  String page = "<!DOCTYPE html><html><head>";
  page += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  page += "<title>Cattle Monitor</title>";
  page += "<link rel='stylesheet' href='https://unpkg.com/leaflet/dist/leaflet.css'/>";
  page += "<script src='https://unpkg.com/leaflet/dist/leaflet.js'></script>";
  page += "<style>";
  page += "body{margin:0; font-family:'Segoe UI',sans-serif; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center;}";
  page += ".navbar{width:100%; background:#1e293b; padding:15px; text-align:center; font-size:20px; font-weight:bold; box-shadow:0 2px 10px rgba(0,0,0,0.5);}";
  page += ".grid{display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:15px; width:95%; max-width:800px; padding:20px;}";
  page += ".card{background:rgba(30,41,59,0.7); padding:20px; border-radius:15px; border:1px solid #334155; text-align:center;}";
  page += ".label{font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;}";
  page += ".value{font-size:28px; font-weight:bold; color:#38bdf8; margin-top:5px;}";
  page += "#map{height:300px; width:95%; max-width:800px; border-radius:15px; margin-bottom:20px; border:2px solid #334155;}";
  page += ".alert{background:#7f1d1d !important; animation: blink 1s infinite;} @keyframes blink{50%{opacity:0.7;}}";
  page += "</style></head><body>";

  page += "<div class='navbar'>Realtime Dairy Monitoring System</div>";
  page += "<div class='grid'>";
  page += "<div class='card'><div class='label'>Heart Rate</div><div id='bpm' class='value'>--</div><small>BPM</small></div>";
  page += "<div class='card'><div id='temp-card'><div class='label'>Body Temp</div><div id='temp' class='value'>--</div><small>°C</small></div></div>";
  page += "<div class='card'><div class='label'>Activity</div><div id='steps' class='value'>--</div><small>Steps</small></div>";
  page += "<div class='card'><div class='label'>Location</div><div id='loc' style='font-size:14px' class='value'>Waiting...</div></div>";
  page += "</div>";
  page += "<div id='map'></div>";

  page += "<script>";
  page += "var map=L.map('map').setView([0,0],2); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);";
  page += "var marker=L.marker([0,0]).addTo(map);";
  page += "function update(){ fetch('/data').then(res=>res.json()).then(d=>{";
  page += "document.getElementById('bpm').innerHTML=d.bpm;";
  page += "document.getElementById('temp').innerHTML=d.temp.toFixed(1);";
  page += "document.getElementById('steps').innerHTML=d.steps;";
  page += "document.getElementById('loc').innerHTML=d.lat.toFixed(4)+','+d.lng.toFixed(4);";
  // Fever alert (Cattle normal is ~38.5C, 39.5C+ is high)
  page += "if(d.temp > 39.5){ document.getElementById('temp-card').classList.add('alert'); } else { document.getElementById('temp-card').classList.remove('alert'); }";
  page += "if(d.lat!=0){ var pos=[d.lat,d.lng]; marker.setLatLng(pos); map.setView(pos,16); }";
  page += "}); } setInterval(update,2000);";
  page += "</script></body></html>";

  server.send(200, "text/html", page);
}

void handleData() {
  String json = "{";
  json += "\"lat\":" + String(latitude, 6) + ",";
  json += "\"lng\":" + String(longitude, 6) + ",";
  json += "\"temp\":" + String(temperature, 2) + ",";
  json += "\"steps\":" + String(steps) + ",";
  json += "\"bpm\":" + String(bpm);
  json += "}";
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17); // Verify your RX/TX pins
  
  Wire.begin(21, 22);
  sensors.begin();
  if(!accel.begin()) Serial.println("ADXL345 not found!");

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  
  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.begin();
  Serial.println("\nSystem Online: " + WiFi.localIP().toString());
}

void loop() {
  // 1. ANALOG PULSE DETECTION (Fast Sampling)
  signalValue = analogRead(pulsePin);
  unsigned long currentTime = millis();

  if (signalValue > threshold && !beatDetected) {
    beatDetected = true;
    unsigned long interval = currentTime - lastBeatTime;
    if (lastBeatTime > 0 && interval > 300 && interval < 2000) {
      int currentBpm = 60000 / interval;
      
      bpmHistory[bpmIndex] = currentBpm;
      bpmIndex = (bpmIndex + 1) % BPM_SAMPLES;
      
      int sum = 0, count = 0;
      for (int i = 0; i < BPM_SAMPLES; i++) {
        if (bpmHistory[i] > 0) {
          sum += bpmHistory[i];
          count++;
        }
      }
      if (count > 0) bpm = sum / count;
    }
    lastBeatTime = currentTime;
  }
  if (signalValue < threshold) {
    beatDetected = false;
  }

  // 2. GPS & SENSORS
  // Ensure we are processing GPS buffer continuously so we do not drop sentences.
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  static unsigned long lastSensorUpdate = 0;
  if (millis() - lastSensorUpdate > 1000) {
    if (gps.location.isUpdated()) {
      latitude = gps.location.lat();
      longitude = gps.location.lng();
    }
    sensors.requestTemperatures();
    temperature = sensors.getTempCByIndex(0);
    lastSensorUpdate = millis();
  }

  // 3. STEP DETECTION
  sensors_event_t event;
  accel.getEvent(&event);
  
  // Calculate squared magnitude directly to avoid expensive sqrt() check
  float mag_sq = sq(event.acceleration.x) + sq(event.acceleration.y) + sq(event.acceleration.z);
  
  if (mag_sq > sq(stepThreshold) && millis() - lastStepTime > 400) {
    steps++;
    lastStepTime = millis();
  }

  // 4. FIREBASE UPLOAD (Every 2 Seconds)
  static unsigned long lastFirebaseUpdate = 0;
  if (millis() - lastFirebaseUpdate > 2000) {
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(FIREBASE_URL);
      http.addHeader("Content-Type", "application/json");
      String json = "{";
      json += "\"lat\":" + String(latitude, 6) + ",";
      json += "\"lng\":" + String(longitude, 6) + ",";
      json += "\"temp\":" + String(temperature, 2) + ",";
      json += "\"steps\":" + String(steps) + ",";
      json += "\"bpm\":" + String(bpm);
      json += "}";
      http.PUT(json);
      http.end();
    }
    lastFirebaseUpdate = millis();
  }

  server.handleClient();
}