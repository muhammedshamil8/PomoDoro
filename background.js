// Background script for PomoDoro Timer (Manifest V3)

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoroTimer') {
      handleTimerCompletion();
    }
  });
  
  async function handleTimerCompletion() {
    try {
      // When the alarm fires, get the current timer state
      const data = await chrome.storage.sync.get('timerState');
      
      if (data.timerState) {
        // Notify the popup that the timer has completed
        chrome.runtime.sendMessage({ type: 'timerCompleted' }).catch(e => {
          console.log("Popup not open, message not sent", e);
        });
        
        // Create a notification even if the popup is closed
        sendNotification(data.timerState.currentMode);
        
        // Handle session count if we just finished a pomodoro
        if (data.timerState.currentMode === 'pomodoro') {
          updateSessionCount();
        }
      }
    } catch (error) {
      console.error("Error handling timer completion:", error);
    }
  }
  
  function sendNotification(currentMode) {
    const notificationDetails = {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'PomoDoro Timer',
      message: getNotificationMessage(currentMode)
    };
  
    chrome.notifications.create(notificationDetails).catch(e => {
      console.error("Error creating notification:", e);
    });
  }
  
  function getNotificationMessage(currentMode) {
    switch (currentMode) {
      case 'pomodoro': 
        return 'Focus session completed! Take a break.';
      case 'shortBreak':
        return 'Short break completed! Time to focus.';
      case 'longBreak':
        return 'Long break completed! Time to focus.';
      default:
        return 'Timer completed!';
    }
  }
  
  async function updateSessionCount() {
    try {
      const result = await chrome.storage.sync.get('sessionCount');
      let count = result.sessionCount || 0;
      count++;
      await chrome.storage.sync.set({ sessionCount: count });
    } catch (error) {
      console.error("Error updating session count:", error);
    }
  }
  
  // Handle extension installation or update
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      initializeDefaultSettings();
    }
  });
  
  async function initializeDefaultSettings() {
    const defaultSettings = {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      autoStartBreaks: false,
      autoStartPomodoros: false
    };
    
    try {
      await chrome.storage.sync.set({ 
        pomodoroSettings: defaultSettings,
        sessionCount: 0
      });
      console.log("Default settings initialized");
    } catch (error) {
      console.error("Error initializing default settings:", error);
    }
  }
  
  // Keep service worker alive (not typically needed in MV3)
  // The following is a more efficient way than using setInterval
  chrome.runtime.onStartup.addListener(() => {
    console.log("Service worker started");
  });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'keepAlive') {
      sendResponse({ alive: true });
    }
  });