
document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode');
    const username = sessionStorage.getItem('scienceNightUsername');
    const eventsContainer = document.getElementById('event-cards-container');
    const userGreeting = document.getElementById('user-greeting');
    const resultsLink = document.getElementById('results-link');
    const initialLoaderContainer = document.getElementById('loader-container-vote');
    const messageContainerId = 'message-container-vote';
    const progressBarFill = document.getElementById('progress-bar-fill');

    // Card stack specific variables
    let cards = [];
    let currentCardIndex = 0;
    let isAnimating = false;
    let userVotes = {}; // Moved here to be accessible in updateCardStackVisuals

    if (!groupCode || !username) {
        window.location.href = 'index.html';
        return;
    }

    userGreeting.textContent = `Angemeldet als: ${username} (Gruppe: ${groupCode})`;
    resultsLink.href = `results.html?code=${encodeURIComponent(groupCode)}`;

    showLoader(initialLoaderContainer.id);

    const [eventsResponse, userVotesResponse] = await Promise.all([
        callGoogleScript('getEvents'),
        callGoogleScript('getUserVotes', { groupCode, username })
    ]);

    hideLoader();

    if (!eventsResponse.success || !eventsResponse.events) {
        displayMessage('Fehler beim Laden der Veranstaltungen.', 'error', messageContainerId, 0);
        return;
    }
    if (!userVotesResponse.success) {
        console.warn('Could not load user votes, proceeding without them.');
    }
    
    userVotes = userVotesResponse.votes || {}; // Assign to the outer scope variable

    if (eventsResponse.events.length === 0) {
        eventsContainer.innerHTML = '<p>Keine Veranstaltungen für die Abstimmung gefunden.</p>';
        return;
    }

    // Create and store card elements
    eventsResponse.events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.eventId = event.id;
        // Initially hide cards that are not on top of the stack
        card.style.display = 'none';
        card.style.position = 'absolute'; // Ensure CSS for absolute positioning is effective

        card.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Zeit:</strong> ${event.time}</p>
            <p><strong>Ort:</strong> ${event.location}</p>
            <div class="vote-buttons">
                <button class="vote-btn downvote" data-score="-1">👎 Nein!!! (-1)</button>
                <button class="vote-btn neutral" data-score="0">🤷 Egal (0)</button>
                <button class="vote-btn upvote" data-score="1">👍 Jaaaaa!!! (+1)</button>
            </div>
        `;

        // Add to eventsContainer so it's in the DOM for measurements, but hidden
        eventsContainer.appendChild(card);
        cards.push(card);

        const buttons = card.querySelectorAll('.vote-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => handleVoteClick(event, card, button, buttons));
        });
    });

    function updateCardStackVisuals() {
        if (!progressBarFill) { // Should be available, but good to check
            console.warn('Progress bar fill element not found');
            // We can still continue to update cards, just not the progress bar
        }

        if (currentCardIndex >= cards.length) {
            eventsContainer.innerHTML = '<p>Alle Veranstaltungen bewertet! 🎉</p>';
            if (progressBarFill) progressBarFill.style.width = '100%'; // Ensure 100% when done
            // Optionally, show a link to results or a refresh button
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

            // Reset pointer events for all cards first
            card.style.pointerEvents = 'none';


            if (isTopCard) {
                card.style.display = '';
                card.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
                card.style.opacity = '1';
                card.style.zIndex = cards.length;
                card.style.pointerEvents = 'auto'; // Enable interaction for the top card

                // Apply pre-existing vote if any
                const eventId = card.dataset.eventId;
                const currentVote = userVotes[eventId];
                const buttons = card.querySelectorAll('.vote-btn');
                buttons.forEach(btn => {
                    btn.classList.remove('selected');
                    if (parseInt(btn.dataset.score) === currentVote) {
                        btn.classList.add('selected');
                    }
                });

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
                card.style.display = 'none'; // Hide cards further down the stack
                card.style.opacity = '0';
            }
        });
    }

    function handleVoteClick(event, card, button, buttons) {
        if (isAnimating) return;
        isAnimating = true;

        const score = parseInt(button.dataset.score);
        const previouslySelectedButton = card.querySelector('.vote-btn.selected');

        // Optimistic UI update for button selection
        buttons.forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');

        // Determine swipe direction for animation
        let swipeTransform = '';
        if (score === -1) { // Downvote (left)
            swipeTransform = 'translateX(-150%) rotate(-15deg)';
        } else if (score === 1) { // Upvote (right)
            swipeTransform = 'translateX(150%) rotate(15deg)';
        } else { // Neutral (animate down slightly, or no animation, then next)
            swipeTransform = 'translateY(50px) scale(0.9)'; // Example for neutral
        }

        card.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
        card.style.transform = swipeTransform;
        card.style.opacity = '0';

        card.addEventListener('transitionend', () => {
            card.style.display = 'none'; // Hide after animation
            currentCardIndex++;
            updateCardStackVisuals();
            isAnimating = false;
        }, { once: true });

        // Send data to Google Script
        callGoogleScript('recordVote', {
            groupCode,
            username,
            eventId: event.id,
            score
        }).then(voteResponse => {
            if (voteResponse.success) {
                userVotes[event.id] = score; // Update local cache
                let scoreEmoji = score === 1 ? '👍' : score === -1 ? '👎' : '🤷';
                displayMessage(`Stimme (${scoreEmoji}) für "${event.title}" gespeichert.`, 'success', messageContainerId);
            } else {
                displayMessage(`Fehler: Stimme für "${event.title}" nicht gespeichert. ${voteResponse.message || ''}`, 'error', messageContainerId, 5000);
                // Rollback UI for button selection (card is already animating out)
                // The next card will show the correct state based on userVotes.
                // If the same card were to be shown again, more complex rollback needed.
            }
        }).catch(error => {
            displayMessage(`Netzwerk-/Skriptfehler beim Speichern für "${event.title}". (${error.message})`, 'error', messageContainerId, 5000);
            // Rollback UI for button selection
        });
    }

    // Initial display
    if (cards.length > 0) {
        updateCardStackVisuals();
    }
});
