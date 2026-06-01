document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode');
    const username = sessionStorage.getItem('scienceNightUsername');
    
    if (!groupCode || !username) {
        window.location.href = 'index.html';
        return;
    }

    const conflictsContainer = document.getElementById('conflicts-container');
    const saveBtn = document.getElementById('save-weights-btn');
    const loaderContainer = document.getElementById('loader-container-conflicts');
    const messageContainerId = 'message-container-conflicts';

    document.getElementById('user-greeting').textContent = `Angemeldet als: ${username} (Gruppe: ${groupCode})`;

    showLoader(loaderContainer.id);

    const [eventsResponse, userVotesResponse] = await Promise.all([
        fetchLocalEvents(),
        callGoogleScript('getUserVotes', { groupCode, username })
    ]);

    hideLoader();

    if (!eventsResponse.success || !userVotesResponse.success) {
        displayMessage('Fehler beim Laden der Daten.', 'error', messageContainerId, 0);
        return;
    }

    const events = eventsResponse.events;
    const votes = userVotesResponse.votes || {};

    const yesEvents = events.filter(e => votes[e.id] === 1);

    // Check overlaps
    function parseTime(tStr) {
        const [h, m] = tStr.split(':').map(Number);
        return (h < 12 ? h + 24 : h) * 60 + m; // shift after midnight to next day
    }

    function doTimeSlotsOverlap(ts1, ts2) {
        return parseTime(ts1.start) < parseTime(ts2.end) && parseTime(ts1.end) > parseTime(ts2.start);
    }

    function doEventsOverlap(e1, e2) {
        for (let t1 of e1.timeSlots) {
            for (let t2 of e2.timeSlots) {
                if (doTimeSlotsOverlap(t1, t2)) return true;
            }
        }
        return false;
    }

    let conflictSet = new Set();
    for (let i = 0; i < yesEvents.length; i++) {
        for (let j = i + 1; j < yesEvents.length; j++) {
            if (doEventsOverlap(yesEvents[i], yesEvents[j])) {
                conflictSet.add(yesEvents[i].id);
                conflictSet.add(yesEvents[j].id);
            }
        }
    }

    async function finishPhase2() {
        showLoader(loaderContainer.id);
        await callGoogleScript('setUserPhase', { groupCode, username, phase: 2 });
        const statusRes = await callGoogleScript('getGroupStatus', { groupCode });
        hideLoader();
        
        if (statusRes.success) {
            const numPhase2 = statusRes.users.filter(u => u.phase2).length;
            if (numPhase2 >= 4) window.location.href = 'results.html';
            else window.location.href = 'wait.html?phase=2';
        } else {
            window.location.href = 'wait.html?phase=2';
        }
    }

    if (conflictSet.size === 0) {
        finishPhase2();
        return;
    }

    const conflictEvents = yesEvents.filter(e => conflictSet.has(e.id));
    
    conflictEvents.forEach(event => {
        const item = document.createElement('div');
        item.className = 'conflict-item';
        item.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>Typ:</strong> ${event.type} | <strong>Ort:</strong> ${event.location}</p>
            <select class="weight-select" data-event-id="${event.id}">
                <option value="1">Egal (1 Stern)</option>
                <option value="2">Nice-to-have (2 Sterne)</option>
                <option value="3" selected>Mittel (3 Sterne)</option>
                <option value="4">Sehr gerne (4 Sterne)</option>
                <option value="5">Must-have (5 Sterne)</option>
            </select>
        `;
        conflictsContainer.appendChild(item);
    });

    saveBtn.style.display = 'block';

    saveBtn.addEventListener('click', async () => {
        const weights = [];
        document.querySelectorAll('.weight-select').forEach(select => {
            weights.push({
                eventId: parseInt(select.dataset.eventId),
                weight: parseInt(select.value)
            });
        });

        showLoader(loaderContainer.id);
        const res = await callGoogleScript('recordWeights', { groupCode, username, weights });
        hideLoader();

        if (res.success) {
            finishPhase2();
        } else {
            displayMessage('Fehler beim Speichern der Gewichtungen.', 'error', messageContainerId);
        }
    });

});