// This file is a wrapper for Google Apps Script calls
async function callGoogleScript(action, payload = {}) {
  const fullPayload = {
    action: action,
    ...payload
  };

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(fullPayload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GAS Web Apps expect text/plain for POST
      },
    });
    
    if (!response.ok) {
      console.error('Network response was not ok:', response.statusText);
      return { success: false, message: `Network error: ${response.statusText}` };
    }
    
    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error calling Google Script:', error);
    return { success: false, message: `Client-side error: ${error.message}` };
  }
}

function showLoader(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.id = 'loading-spinner';
        // Clear previous loader if any, or prepend
        const existingLoader = document.getElementById('loading-spinner');
        if (existingLoader) existingLoader.remove();
        container.prepend(loader); // Or append, depending on desired position
    }
}

function hideLoader() {
    const loader = document.getElementById('loading-spinner');
    if (loader) {
        loader.remove();
    }
}

let messageTimeoutId = null;

function displayMessage(message, type = 'error', containerId = 'message-container', timeout = 3500) {
    const container = document.getElementById(containerId);
    if (container) {
        // Vorherigen Timeout löschen, falls vorhanden
        if (messageTimeoutId) {
            clearTimeout(messageTimeoutId);
        }

        const messageDiv = document.createElement('div');
        // Stelle sicher, dass du auch eine .success-message Klasse im CSS hast
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        
        container.innerHTML = ''; // Alte Nachricht entfernen
        container.appendChild(messageDiv);

        if (timeout > 0) {
            messageTimeoutId = setTimeout(() => {
                // Nur entfernen, wenn es noch die aktuelle Nachricht ist und der Container noch das Div enthält
                if (container.contains(messageDiv)) {
                     container.innerHTML = '';
                }
                messageTimeoutId = null;
            }, timeout);
        }
    } else {
        alert(message); // Fallback
    }
}
