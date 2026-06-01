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
        

        if (response.success) {
            sessionStorage.setItem('scienceNightGroupCode', groupCode);
            sessionStorage.setItem('scienceNightUsername', username);

            const statusRes = await callGoogleScript('getGroupStatus', { groupCode });
            hideLoader();

            if (statusRes.success) {
                const users = statusRes.users;
                const myStatus = users.find(u => u.username === username);
                const numPhase1 = users.filter(u => u.phase1).length;
                const numPhase2 = users.filter(u => u.phase2).length;

                if (myStatus && myStatus.phase2) {
                    if (numPhase2 >= 4) window.location.href = 'results.html';
                    else window.location.href = 'wait.html?phase=2';
                } else if (myStatus && myStatus.phase1) {
                    if (numPhase1 >= 4) window.location.href = 'conflicts.html';
                    else window.location.href = 'wait.html?phase=1';
                } else {
                    window.location.href = 'vote.html';
                }
            } else {
                window.location.href = 'vote.html';
            }
        } else {
            hideLoader();
            displayMessage(response.message || 'Login fehlgeschlagen. Bitte überprüfe deine Eingaben.', 'error', 'message-container');
        }
    });
});
