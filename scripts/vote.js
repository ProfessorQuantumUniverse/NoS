
document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode');
    const username = sessionStorage.getItem('scienceNightUsername');
    const eventsContainer = document.getElementById('event-cards-container');
    const userGreeting = document.getElementById('user-greeting');
    const resultsLink = document.getElementById('results-link');
    // Der globale Loader-Container bleibt für das initiale Laden
    const initialLoaderContainer = document.getElementById('loader-container-vote'); 
    const messageContainerId = 'message-container-vote'; // ID des Nachrichten-Containers

    if (!groupCode || !username) {
        window.location.href = 'index.html';
        return;
    }

    userGreeting.textContent = `Angemeldet als: ${username} (Gruppe: ${groupCode})`;
    resultsLink.href = `results.html?code=${encodeURIComponent(groupCode)}`;

    showLoader(initialLoaderContainer.id); // Loader für initiales Laden

    const [eventsResponse, userVotesResponse] = await Promise.all([
        callGoogleScript('getEvents'),
        callGoogleScript('getUserVotes', { groupCode, username })
    ]);

    hideLoader(); // Loader nach initialem Laden ausblenden

    if (!eventsResponse.success || !eventsResponse.events) {
        displayMessage('Fehler beim Laden der Veranstaltungen.', 'error', messageContainerId, 0); // 0 = kein Timeout
        return;
    }
    if (!userVotesResponse.success) {
        console.warn('Could not load user votes, proceeding without them.');
        // Optional: displayMessage('Konnte bisherige Stimmen nicht laden.', 'error', messageContainerId);
    }
    
    const userVotes = userVotesResponse.votes || {};

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

            button.addEventListener('click', () => { // async hier nicht mehr nötig, da wir nicht mehr awaiten
                const score = parseInt(button.dataset.score);
                const previouslySelectedButton = card.querySelector('.vote-btn.selected');
                
                // 1. Optimistic UI update: Buttons sofort aktualisieren
                buttons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                
                // 2. Alten globalen Loader entfernen.
                // KEIN showLoader() / hideLoader() hier für den einzelnen Vote.

                // 3. Daten im Hintergrund senden
                callGoogleScript('recordVote', {
                    groupCode,
                    username,
                    eventId: event.id,
                    score
                }).then(voteResponse => {
                    if (voteResponse.success) {
                        // Lokalen Cache der Stimmen aktualisieren
                        userVotes[event.id] = score;
                        let scoreEmoji = score === 1 ? '👍' : score === -1 ? '👎' : '🤷';
                        displayMessage(`Stimme (${scoreEmoji}) für "${event.title}" gespeichert.`, 'success', messageContainerId);
                    } else {
                        // Fehler beim Speichern: UI Rollback
                        displayMessage(`Fehler: Stimme für "${event.title}" nicht gespeichert. ${voteResponse.message || ''}`, 'error', messageContainerId, 5000);
                        buttons.forEach(btn => btn.classList.remove('selected')); // Aktuelle Auswahl entfernen
                        if (previouslySelectedButton) { // Alten Button wieder auswählen, falls vorhanden
                            previouslySelectedButton.classList.add('selected');
                        } else if (userVotes[event.id] !== undefined) { // Oder auf den alten Wert aus dem Cache zurücksetzen
                            const oldScore = userVotes[event.id];
                            buttons.forEach(btn => {
                                if (parseInt(btn.dataset.score) === oldScore) {
                                    btn.classList.add('selected');
                                }
                            });
                        }
                    }
                }).catch(error => {
                    // Netzwerkfehler oder Skriptfehler: UI Rollback
                    displayMessage(`Netzwerk-/Skriptfehler beim Speichern für "${event.title}". Bitte erneut versuchen. (${error.message})`, 'error', messageContainerId, 5000);
                    buttons.forEach(btn => btn.classList.remove('selected')); // Aktuelle Auswahl entfernen
                    if (previouslySelectedButton) { // Alten Button wieder auswählen, falls vorhanden
                        previouslySelectedButton.classList.add('selected');
                    } else if (userVotes[event.id] !== undefined) {
                         const oldScore = userVotes[event.id];
                         buttons.forEach(btn => {
                             if (parseInt(btn.dataset.score) === oldScore) {
                                 btn.classList.add('selected');
                             }
                         });
                    }
                });
            });
        });
    });
});
