document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const groupCodeInput = document.getElementById('group-code');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageContainer = document.getElementById('message-container');
    const loaderContainer = document.getElementById('loader-container');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageContainer.innerHTML = '';
        showLoader('loader-container');

        const groupCode = groupCodeInput.value.trim().toUpperCase();
        const username = usernameInput.value.trim();
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
