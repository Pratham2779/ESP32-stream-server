#include "esp_camera.h"
#include <WiFi.h>
#include <WebSocketsClient.h> 
#include <ArduinoJson.h>

// --- YOUR CONFIGURATION ---
const char* ssid = "Android";
const char* password = "9623108820"; 

// UPDATE THESE FOR LOCAL TESTING:
const char* websocket_host = "192.168.43.116"; 
const uint16_t websocket_port = 3000;        

WebSocketsClient webSocket;

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_GPIO_NUM     4 

unsigned long lastTelemetryTime = 0;
int reconnectCount = 0;

#ifdef __cplusplus
extern "C" {
uint8_t temprature_sens_read();
}
#endif

void handleCommands(uint8_t * payload, size_t length) {
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    
    if (error) {
        Serial.println("JSON parse error");
        return;
    }

    const char* cmd = doc["cmd"];
    if (!cmd) return;
    
    if (strcmp(cmd, "flash") == 0) {
        int val = doc["val"];
        digitalWrite(FLASH_GPIO_NUM, val ? HIGH : LOW);
    } 
    else if (strcmp(cmd, "resolution") == 0) {
        int res = doc["val"];
        sensor_t * s = esp_camera_sensor_get();
        s->set_framesize(s, (framesize_t)res);
    }
    else if (strcmp(cmd, "ping") == 0) {
        String response = "{\"cmd\":\"pong\"}";
        webSocket.sendTXT(response);
    }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      reconnectCount++;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WSc] Connected to url: %s\n", payload);
      break;
    case WStype_TEXT:
      handleCommands(payload, length);
      break;
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(FLASH_GPIO_NUM, OUTPUT);
  digitalWrite(FLASH_GPIO_NUM, LOW);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.println(WiFi.localIP());

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  config.frame_size = FRAMESIZE_VGA;  
  config.jpeg_quality = 10;           
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed");
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  // Image orientation mapped properly for hardware mounting
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);

  webSocket.begin(websocket_host, websocket_port, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void sendTelemetry() {
    StaticJsonDocument<256> doc;
    doc["type"] = "telemetry";
    doc["heap"] = ESP.getFreeHeap() / 1024;
    doc["rssi"] = WiFi.RSSI();
    doc["uptime"] = millis();
    doc["reconnects"] = reconnectCount;
    doc["temp"] = (temprature_sens_read() - 32) * 5.0 / 9.0;
    doc["ip"] = WiFi.localIP().toString();
    
    String jsonString;
    serializeJson(doc, jsonString);
    webSocket.sendTXT(jsonString);
}

void loop() {
  webSocket.loop();

  if (webSocket.isConnected()) {
    if (millis() - lastTelemetryTime > 2000) {
        sendTelemetry();
        lastTelemetryTime = millis();
    }

    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) return;

    webSocket.sendBIN(fb->buf, fb->len);
    esp_camera_fb_return(fb);
    delay(50); 
  }
}