document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const groupCodeInput = document.getElementById('group-code');
    const usernameSelect = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageContainer = document.getElementById('message-container');
    const loaderContainer = document.getElementById('loader-container');

    let debounceTimer;
    groupCodeInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const groupCode = groupCodeInput.value.trim().toUpperCase();
            if (groupCode) {
                showLoader('loader-container');
                messageContainer.innerHTML = '';
                const response = await callGoogleScript('getUsersForGroup', { groupCode });
                hideLoader();
                
                usernameSelect.innerHTML = '<option value="">Wähle Benutzername</option>';
                if (response.success && response.users && response.users.length > 0) {
                    response.users.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user;
                        option.textContent = user;
                        usernameSelect.appendChild(option);
                    });
                    usernameSelect.disabled = false;
                } else {
                    usernameSelect.disabled = true;
                    if(response.users && response.users.length === 0 && groupCodeInput.value.length > 3) { // only show if group code likely typed
                        displayMessage('Keine Benutzer für diesen Gruppencode gefunden oder Code ungültig.', 'error', 'message-container');
                    }
                }
            } else {
                usernameSelect.innerHTML = '<option value="">Bitte zuerst Gruppencode eingeben</option>';
                usernameSelect.disabled = true;
            }
        }, 500); // Debounce time
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageContainer.innerHTML = '';
        showLoader('loader-container');

        const groupCode = groupCodeInput.value.trim().toUpperCase();
        const username = usernameSelect.value;
        const password = passwordInput.value;

        if (!groupCode || !username || !password) {
            hideLoader();
            displayMessage('Bitte alle Felder ausfüllen.', 'error', 'message-container');
            return;
        }

        const response = await callGoogleScript('validateLogin', { groupCode, username, password });
        hideLoader();

        if (response.success) {
            sessionStorage.setItem('scienceNightGroupCode', groupCode);
            sessionStorage.setItem('scienceNightUsername', username);
            window.location.href = 'vote.html';
        } else {
            displayMessage(response.message || 'Login fehlgeschlagen. Bitte überprüfe deine Eingaben.', 'error', 'message-container');
        }
    });
});