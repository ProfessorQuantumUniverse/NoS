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

    async function finishPhase1() {
        showLoader(initialLoaderContainer.id);
        await callGoogleScript('setUserPhase', { groupCode, username, phase: 1 });
        const statusRes = await callGoogleScript('getGroupStatus', { groupCode });
        hideLoader();
        
        if (statusRes.success) {
            const numPhase1 = statusRes.users.filter(u => u.phase1).length;
            if (numPhase1 >= 4) window.location.href = 'conflicts.html';
            else window.location.href = 'wait.html?phase=1';
        } else {
            window.location.href = 'wait.html?phase=1';
        }
    }

    if (remainingEvents.length === 0) {
        finishPhase1();
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
            <div class="event-card-content">
                <h3>${event.title}</h3>
                <p><strong>Typ:</strong> ${event.type}</p>
                <p><strong>Zeit:</strong> ${times}</p>
                <p><strong>Ort:</strong> ${event.location}</p>
            </div>
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
            finishPhase1();
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
                card.style.transform = 'translateY(0) scale(1) rotate(0deg)';
                card.style.opacity = '1';
                card.style.zIndex = cards.length;
                card.style.pointerEvents = 'auto';
            } else if (isSecondCard) {
                card.style.display = '';
                card.style.transform = 'translateY(15px) scale(0.95)';
                card.style.opacity = '0.8';
                card.style.zIndex = cards.length - 1;
            } else if (isThirdCard) {
                card.style.display = '';
                card.style.transform = 'translateY(30px) scale(0.9)';
                card.style.opacity = '0.5';
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