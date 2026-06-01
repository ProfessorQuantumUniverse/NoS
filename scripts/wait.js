document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode');
    const username = sessionStorage.getItem('scienceNightUsername');
    
    if (!groupCode || !username) {
        window.location.href = 'index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetPhase = parseInt(urlParams.get('phase')) || 1; // 1 means waiting for everyone to finish phase 1

    const waitTitle = document.getElementById('wait-title');
    const waitMessage = document.getElementById('wait-message');
    const nextBtn = document.getElementById('next-btn');
    const retryBtn = document.getElementById('retry-btn');
    const loaderContainer = document.getElementById('loader-container-wait');

    waitTitle.textContent = `Phase ${targetPhase} abgeschlossen!`;
    
    let timerId = null;

    async function checkStatus() {
        showLoader('loader-container-wait');
        const res = await callGoogleScript('getGroupStatus', { groupCode });
        hideLoader();

        if (res.success) {
            const users = res.users;
            const myStatus = users.find(u => u.username === username);
            
            let finishedCount = 0;
            if (targetPhase === 1) {
                finishedCount = users.filter(u => u.phase1).length;
            } else {
                finishedCount = users.filter(u => u.phase2).length;
            }

            if (finishedCount >= 4) {
                waitMessage.textContent = 'Alle 4 Personen haben diesen Bereich abgeschlossen! Du kannst nun weitergehen.';
                nextBtn.style.display = 'inline-block';
                retryBtn.style.display = 'none';
                if (timerId) clearTimeout(timerId);
            } else {
                waitMessage.textContent = `Bisher haben ${finishedCount} von 4 Personen diesen Bereich abgeschlossen. Bitte warten...`;
                timerId = setTimeout(checkStatus, 5000);
            }
        } else {
            waitMessage.textContent = 'Fehler beim Laden des Status.';
            timerId = setTimeout(checkStatus, 5000);
        }
    }

    nextBtn.addEventListener('click', () => {
        if (targetPhase === 1) {
            window.location.href = 'conflicts.html';
        } else {
            window.location.href = 'results.html';
        }
    });

    retryBtn.addEventListener('click', () => {
        if (timerId) clearTimeout(timerId);
        checkStatus();
    });

    checkStatus();
});