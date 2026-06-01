document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode');
    const username = sessionStorage.getItem('scienceNightUsername');
    const eventsContainer = document.getElementById('event-cards-container');
    const userGreeting = document.getElementById('user-greeting');
    const resultsLink = document.getElementById('results-link');
    const initialLoaderContainer = document.getElementById('loader-container-vote');
    const messageContainerId = 'message-container-vote';
    const progressBarFill = document.getElementById('progress-bar-fill');

    let cards = [];
    let currentCardIndex = 0;
    let isAnimating = false;
    let userVotes = {};

    if (!groupCode || !username) {
        window.location.href = 'index.html';
        return;
    }

    userGreeting.textContent = `Angemeldet als: ${username} (Gruppe: ${groupCode})`;
    resultsLink.href = `results.html?code=${encodeURIComponent(groupCode)}`;

    showLoader(initialLoaderContainer.id);

    const [eventsResponse, userVotesResponse] = await Promise.all([
        fetchLocalEvents(),
        callGoogleScript('getUserVotes', { groupCode, username })
    ]);

    hideLoader();

    if (!eventsResponse.success || !eventsResponse.events) {
        displayMessage('Fehler beim Laden der Veranstaltungen.', 'error', messageContainerId, 0);
        return;
    }
    
    userVotes = userVotesResponse.votes || {};

    const remainingEvents = eventsResponse.events.filter(e => userVotes[e.id] === undefined);

    async function checkAndProceedToConflicts() {
        showLoader(initialLoaderContainer.id);
        eventsContainer.style.display = 'none';
        
        await callGoogleScript('setUserStatus', { groupCode, username, phase: 1 });
        const statusRes = await callGoogleScript('getGroupStatus', { groupCode });
        hideLoader();
        
        if (statusRes.success) {
            const statuses = statusRes.statuses || {};
            let phase1Count = 0;
            for (let key in statuses) {
                if (statuses[key] >= 1) phase1Count++;
            }
            if (phase1Count < 4) {
                displayMessage(`Du bist fertig! Warte auf deine Freunde (${phase1Count}/4 haben Phase 1 abgeschlossen). Bitte lade die Seite in ein paar Minuten neu.`, 'success', messageContainerId, 0);
                
                // Optional: Simple polling or refresh button
                const btn = document.createElement('button');
                btn.className = 'btn';
                btn.textContent = 'Status aktualisieren';
                btn.style.marginTop = '20px';
                btn.onclick = () => window.location.reload();
                document.getElementById(messageContainerId).appendChild(btn);
            } else {
                window.location.href = 'conflicts.html';
            }
        } else {
            displayMessage('Fehler beim Abrufen des Gruppenstatus.', 'error', messageContainerId, 0);
        }
    }

    if (remainingEvents.length === 0) {
        checkAndProceedToConflicts();
        return;
    }

    remainingEvents.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.eventId = event.id;
        card.style.display = 'none';
        card.style.position = 'absolute';

        let times = event.timeSlots.map(t => `${t.start}-${t.end}`).join(', ');

        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Typ:</strong> ${event.type}</p>
            <p><strong>Zeit:</strong> ${times}</p>
            <p><strong>Ort:</strong> ${event.location}</p>
            <div class="vote-buttons">
                <button class="vote-btn downvote" data-score="-1">👎 Nein</button>
                <button class="vote-btn upvote" data-score="1">👍 Ja</button>
            </div>
        `;

        eventsContainer.appendChild(card);
        cards.push(card);

        const buttons = card.querySelectorAll('.vote-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => handleVoteClick(event, card, button));
        });
    });

    function updateCardStackVisuals() {
        if (currentCardIndex >= cards.length) {
            checkAndProceedToConflicts();
            return;
        }

        if (progressBarFill) {
            const progress = cards.length > 0 ? ((currentCardIndex) / cards.length) * 100 : 0;
            progressBarFill.style.width = progress + '%';
        }

        cards.forEach((card, index) => {
            const isTopCard = index === currentCardIndex;
            const isSecondCard = index === currentCardIndex + 1;
            const isThirdCard = index === currentCardIndex + 2;

            card.style.pointerEvents = 'none';

            if (isTopCard) {
                card.style.display = '';
                card.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
                card.style.opacity = '1';
                card.style.zIndex = cards.length;
                card.style.pointerEvents = 'auto';
            } else if (isSecondCard) {
                card.style.display = '';
                card.style.transform = 'translateY(10px) scale(0.95)';
                card.style.opacity = '0.7';
                card.style.zIndex = cards.length - 1;
            } else if (isThirdCard) {
                card.style.display = '';
                card.style.transform = 'translateY(20px) scale(0.9)';
                card.style.opacity = '0.4';
                card.style.zIndex = cards.length - 2;
            } else {
                card.style.display = 'none';
                card.style.opacity = '0';
            }
        });
    }

    function handleVoteClick(event, card, button) {
        if (isAnimating) return;
        isAnimating = true;

        const score = parseInt(button.dataset.score);
        let swipeTransform = score === -1 ? 'translateX(-150%) rotate(-15deg)' : 'translateX(150%) rotate(15deg)';

        card.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
        card.style.transform = swipeTransform;
        card.style.opacity = '0';

        card.addEventListener('transitionend', () => {
            card.style.display = 'none';
            currentCardIndex++;
            updateCardStackVisuals();
            isAnimating = false;
        }, { once: true });

        callGoogleScript('recordVote', {
            groupCode,
            username,
            eventId: event.id,
            score
        });
    }

    if (cards.length > 0) {
        updateCardStackVisuals();
    }
});