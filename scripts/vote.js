document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode');
    const username = sessionStorage.getItem('scienceNightUsername');
    const eventsContainer = document.getElementById('event-cards-container');
    const userGreeting = document.getElementById('user-greeting');
    const resultsLink = document.getElementById('results-link');
    const loaderContainer = document.getElementById('loader-container-vote');
    const messageContainer = document.getElementById('message-container-vote');

    if (!groupCode || !username) {
        window.location.href = 'index.html';
        return;
    }

    userGreeting.textContent = `Angemeldet als: ${username} (Gruppe: ${groupCode})`;
    resultsLink.href = `results.html?code=${encodeURIComponent(groupCode)}`;

    showLoader('loader-container-vote');

    const [eventsResponse, userVotesResponse] = await Promise.all([
        callGoogleScript('getEvents'),
        callGoogleScript('getUserVotes', { groupCode, username })
    ]);

    hideLoader();

    if (!eventsResponse.success || !eventsResponse.events) {
        displayMessage('Fehler beim Laden der Veranstaltungen.', 'error', 'message-container-vote');
        return;
    }
    if (!userVotesResponse.success) {
        // Non-critical, user might not have voted yet
        console.warn('Could not load user votes, proceeding without them.');
    }
    
    const userVotes = userVotesResponse.votes || {}; // { eventId: score }

    if (eventsResponse.events.length === 0) {
        eventsContainer.innerHTML = '<p>Keine Veranstaltungen für die Abstimmung gefunden.</p>';
        return;
    }

    eventsResponse.events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.eventId = event.id;

        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Zeit:</strong> ${event.time}</p>
            <p><strong>Ort:</strong> ${event.location}</p>
            <div class="vote-buttons">
                <button class="vote-btn downvote" data-score="-1">👎 Links (-1)</button>
                <button class="vote-btn neutral" data-score="0">🤷 Egal (0)</button>
                <button class="vote-btn upvote" data-score="1">👍 Rechts (+1)</button>
            </div>
        `;
        eventsContainer.appendChild(card);

        const buttons = card.querySelectorAll('.vote-btn');
        const currentVote = userVotes[event.id];

        buttons.forEach(button => {
            if (parseInt(button.dataset.score) === currentVote) {
                button.classList.add('selected');
            }
            button.addEventListener('click', async () => {
                const score = parseInt(button.dataset.score);
                
                // Optimistic UI update
                buttons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                
                showLoader('loader-container-vote'); // Show loader for this action
                const voteResponse = await callGoogleScript('recordVote', {
                    groupCode,
                    username,
                    eventId: event.id,
                    score
                });
                hideLoader();

                if (voteResponse.success) {
                    // Update userVotes cache
                    userVotes[event.id] = score;
                    displayMessage(`Stimme für "${event.title}" gespeichert!`, 'success', 'message-container-vote');
                    setTimeout(() => messageContainer.innerHTML = '', 3000); // Clear message
                } else {
                    displayMessage(`Fehler beim Speichern der Stimme für "${event.title}".`, 'error', 'message-container-vote');
                    // Revert UI if failed
                    buttons.forEach(btn => btn.classList.remove('selected'));
                    // Re-select previous vote if it existed
                    const previousVote = userVotes[event.id];
                     buttons.forEach(btn => {
                        if (parseInt(btn.dataset.score) === previousVote) {
                            btn.classList.add('selected');
                        }
                    });
                }
            });
        });
    });
});
