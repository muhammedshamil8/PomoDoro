// Timer settings and state
let timerInterval = null;
let timeLeft = 25 * 60; // Default: 25 minutes in seconds
let totalTime = 25 * 60;
let isRunning = false;
let currentMode = 'pomodoro';
let sessionCount = 0;

// Default settings
let settings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartBreaks: false,
  autoStartPomodoros: false
};

// DOM elements
const timeDisplay = document.getElementById('time');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const modeButtons = document.querySelectorAll('.mode-btn');
const progressRing = document.querySelector('.progress-ring-circle');
const focusDurationInput = document.getElementById('focusDuration');
const shortBreakDurationInput = document.getElementById('shortBreakDuration');
const longBreakDurationInput = document.getElementById('longBreakDuration');
const autoStartBreaksInput = document.getElementById('autoStartBreaks');
const autoStartPomodorosInput = document.getElementById('autoStartPomodoros');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const saveSettingsBtn = document.getElementById('saveSettings');
const sessionCountDisplay = document.getElementById('sessionCount');

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get('pomodoroSettings', (data) => {
    if (data.pomodoroSettings) {
      settings = data.pomodoroSettings;
      updateSettingsUI();
    }
  });
  
  chrome.storage.sync.get('sessionCount', (data) => {
    if (data.sessionCount) {
      sessionCount = data.sessionCount;
      sessionCountDisplay.textContent = sessionCount;
    }
  });
}

// Update settings UI
function updateSettingsUI() {
  focusDurationInput.value = settings.focusDuration;
  shortBreakDurationInput.value = settings.shortBreakDuration;
  longBreakDurationInput.value = settings.longBreakDuration;
  autoStartBreaksInput.checked = settings.autoStartBreaks;
  autoStartPomodorosInput.checked = settings.autoStartPomodoros;
}

// Save settings to storage
function saveSettings() {
  settings = {
    focusDuration: parseInt(focusDurationInput.value, 10) || 25,
    shortBreakDuration: parseInt(shortBreakDurationInput.value, 10) || 5,
    longBreakDuration: parseInt(longBreakDurationInput.value, 10) || 15,
    autoStartBreaks: autoStartBreaksInput.checked,
    autoStartPomodoros: autoStartPomodorosInput.checked
  };
  
  chrome.storage.sync.set({ pomodoroSettings: settings }, () => {
    settingsPanel.classList.add('hidden');
    resetTimer();
  });
}

// Update time display
function updateDisplay() {
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  timeDisplay.textContent = `${minutes}:${seconds}`;
  
  // Update progress ring
  const offset = 565.48 * (1 - timeLeft / totalTime) || 0;
  progressRing.style.strokeDashoffset = offset;
  
  // Update document title to show remaining time
  document.title = `${minutes}:${seconds} - PomoDoro Timer`;
}

// Start the timer
function startTimer() {
  if (isRunning) return;
  
  isRunning = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  
  // Create an alarm that will trigger in the background
  const alarmName = 'pomodoroTimer';
  chrome.alarms.create(alarmName, { delayInMinutes: timeLeft / 60 });
  
  // Save current timer state
  saveTimerState();
  
  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerCompleted();
      return;
    }
    
    timeLeft--;
    updateDisplay();
    saveTimerState();
  }, 1000);
}

// Pause the timer
function pauseTimer() {
  if (!isRunning) return;
  
  isRunning = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  clearInterval(timerInterval);
  chrome.alarms.clear('pomodoroTimer');
  
  // Save current timer state
  saveTimerState();
}

// Reset the timer
function resetTimer() {
  pauseTimer();
  
  switch (currentMode) {
    case 'pomodoro':
      timeLeft = settings.focusDuration * 60;
      break;
    case 'shortBreak':
      timeLeft = settings.shortBreakDuration * 60;
      break;
    case 'longBreak':
      timeLeft = settings.longBreakDuration * 60;
      break;
  }
  
  totalTime = timeLeft;
  updateDisplay();
  saveTimerState();
}

// Save timer state to storage
function saveTimerState() {
  chrome.storage.sync.set({
    timerState: {
      timeLeft,
      totalTime,
      isRunning,
      currentMode,
      lastUpdated: Date.now()
    }
  });
}

// Load timer state from storage
function loadTimerState() {
  chrome.storage.sync.get('timerState', (data) => {
    if (data.timerState) {
      const { timeLeft: savedTimeLeft, totalTime: savedTotalTime, isRunning: savedIsRunning, currentMode: savedMode, lastUpdated } = data.timerState;
      
      // Only restore if the state is recent (within 1 minute)
      const timePassed = (Date.now() - lastUpdated) / 1000;
      if (timePassed < 60) {
        currentMode = savedMode;
        totalTime = savedTotalTime;
        
        // Adjust the time left based on how much time has passed
        timeLeft = Math.max(0, savedTimeLeft - Math.floor(timePassed));
        
        updateModeUI(currentMode);
        updateDisplay();
        
        if (savedIsRunning) {
          startTimer();
        }
      }
    }
  });
}

// Timer completed
function timerCompleted() {
  isRunning = false;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  // Play notification sound
  const audio = new Audio('notification.mp3');
  audio.play().catch(e => console.log('Error playing sound:', e));
  
  // Create a notification
  let message = '';
  let nextMode = '';
  
  if (currentMode === 'pomodoro') {
    message = 'Focus session completed! Take a break.';
    nextMode = sessionCount % 4 === 3 ? 'longBreak' : 'shortBreak';
    sessionCount++;
    
    // Save session count
    chrome.storage.sync.set({ sessionCount });
    sessionCountDisplay.textContent = sessionCount;
    
    // Auto-start break if enabled
    if (settings.autoStartBreaks) {
      switchMode(nextMode);
      startTimer();
    }
  } else {
    message = currentMode === 'shortBreak' ? 'Short break completed!' : 'Long break completed!';
    nextMode = 'pomodoro';
    
    // Auto-start pomodoro if enabled
    if (settings.autoStartPomodoros) {
      switchMode(nextMode);
      startTimer();
    }
  }
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'PomoDoro Timer',
    message: message
  });
}

// Switch timer mode
function switchMode(mode) {
  currentMode = mode;
  
  // Reset and update the timer for the new mode
  pauseTimer();
  
  switch (mode) {
    case 'pomodoro':
      timeLeft = settings.focusDuration * 60;
      document.body.className = '';
      break;
    case 'shortBreak':
      timeLeft = settings.shortBreakDuration * 60;
      document.body.className = 'break-mode';
      break;
    case 'longBreak':
      timeLeft = settings.longBreakDuration * 60;
      document.body.className = 'long-break-mode';
      break;
  }
  
  totalTime = timeLeft;
  updateDisplay();
  updateModeUI(mode);
  saveTimerState();
}

// Update mode UI
function updateModeUI(mode) {
  modeButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.id === mode) {
      btn.classList.add('active');
    }
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTimerState();
  updateDisplay();
  
  // If no timer state was loaded, initialize with default settings
  if (!timerInterval && timeLeft === 25 * 60) {
    resetTimer();
  }
});

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Mode buttons
document.getElementById('pomodoro').addEventListener('click', () => switchMode('pomodoro'));
document.getElementById('shortBreak').addEventListener('click', () => switchMode('shortBreak'));
document.getElementById('longBreak').addEventListener('click', () => switchMode('longBreak'));

// Settings panel
settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

saveSettingsBtn.addEventListener('click', saveSettings);

// Listen for alarm events from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'timerCompleted') {
    clearInterval(timerInterval);
    timerCompleted();
  }
});