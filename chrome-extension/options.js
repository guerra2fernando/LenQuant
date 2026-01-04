/**
 * LenQuant Binance Assistant - Options Page Script
 */

const DEFAULT_SETTINGS = {
  apiUrl: 'https://lenquant.com',
  wsUrl: 'wss://lenquant.com',
  autoShow: true,
  behaviorAlerts: true,
  autoExplain: false,
  maxLeverage: 20,
  soundAlerts: false,
  debugMode: false,
};

// Toggle handling
document.querySelectorAll('.toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
  });
});

// Load settings
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    const settings = { ...DEFAULT_SETTINGS, ...result.settings };
    
    document.getElementById('api-url').value = settings.apiUrl;
    document.getElementById('ws-url').value = settings.wsUrl;
    document.getElementById('max-leverage').value = settings.maxLeverage;
    
    setToggle('toggle-auto-show', settings.autoShow);
    setToggle('toggle-behavior-alerts', settings.behaviorAlerts);
    setToggle('toggle-auto-explain', settings.autoExplain);
    setToggle('toggle-sound', settings.soundAlerts);
    setToggle('toggle-debug', settings.debugMode);
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function setToggle(id, value) {
  const toggle = document.getElementById(id);
  if (value) {
    toggle.classList.add('active');
  } else {
    toggle.classList.remove('active');
  }
}

function getToggle(id) {
  return document.getElementById(id).classList.contains('active');
}

// Save settings
async function saveSettings() {
  const settings = {
    apiUrl: document.getElementById('api-url').value,
    wsUrl: document.getElementById('ws-url').value,
    maxLeverage: parseInt(document.getElementById('max-leverage').value, 10),
    autoShow: getToggle('toggle-auto-show'),
    behaviorAlerts: getToggle('toggle-behavior-alerts'),
    autoExplain: getToggle('toggle-auto-explain'),
    soundAlerts: getToggle('toggle-sound'),
    debugMode: getToggle('toggle-debug'),
  };
  
  try {
    await chrome.storage.sync.set({ settings });
    
    // Show saved message
    const msg = document.getElementById('saved-message');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings');
  }
}

// Reset to defaults
async function resetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    try {
      await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
      loadSettings();
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }
}

// Event listeners
document.getElementById('btn-save').addEventListener('click', saveSettings);
document.getElementById('btn-reset').addEventListener('click', resetSettings);

// Initialize
loadSettings();

