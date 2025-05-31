document.addEventListener('DOMContentLoaded', async () => {
    const resultsList = document.getElementById('results-list');
    const resultsTitle = document.getElementById('results-title');
    const backToVoteLink = document.getElementById('back-to-vote-link');
    const loaderContainer = document.getElementById('loader-container-results');
    const messageContainer = document.getElementById('message-container-results');


    const urlParams = new URLSearchParams(window.location.search);
    const groupCode = urlParams.get('code');

    if (!groupCode) {
        resultsList.innerHTML = '<p>Kein Gruppencode in der URL gefunden. Beispiel: /results.html?code=ASTRO2025</p>';
        return;
    }
    
    // Show back to vote link if user is logged in to this group
    const loggedInGroupCode = sessionStorage.getItem('scienceNightGroupCode');
    if (loggedInGroupCode && loggedInGroupCode.toUpperCase() === groupCode.toUpperCase()) {
        backToVoteLink.style.display = 'inline-block';
    }


    resultsTitle.textContent = `Ergebnisse für Gruppe: ${groupCode.toUpperCase()}`;
    showLoader('loader-container-results');

    const response = await callGoogleScript('getAggregatedResults', { groupCode });
    hideLoader();

    if (response.success && response.results) {
        if (response.results.length === 0) {
            resultsList.innerHTML = '<p>Noch keine Abstimmungen für diese Gruppe oder keine Events vorhanden.</p>';
            return;
        }
        response.results.forEach(event => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <h3>${event.title}</h3>
                <p><strong>Zeit:</strong> ${event.time}</p>
                <p><strong>Ort:</strong> ${event.location}</p>
                <div class="result-scores">
                    <span class="score-up">👍 Upvotes: ${event.upvotes}</span>
                    <span class="score-neutral">🤷 Egal: ${event.neutral}</span>
                    <span class="score-down">👎 Downvotes: ${event.downvotes}</span>
                    <br>
                    <span class="score-total">Gesamtpunktzahl: ${event.totalScore}</span>
                </div>
            `;
            resultsList.appendChild(listItem);
        });
    } else {
        displayMessage(response.message || 'Fehler beim Laden der Ergebnisse.', 'error', 'message-container-results');
    }
});