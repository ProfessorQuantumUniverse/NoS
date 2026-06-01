document.addEventListener('DOMContentLoaded', async () => {
    const groupCode = sessionStorage.getItem('scienceNightGroupCode') || new URLSearchParams(window.location.search).get('code');
    
    if (!groupCode) {
        window.location.href = 'index.html';
        return;
    }

    const resultsList = document.getElementById('results-container');
    const title = document.getElementById('results-title');
    title.textContent = `Ergebnisse & Master-Plan (Gruppe: ${groupCode})`;

    showLoader('loader-container-results');

    const [eventsResponse, groupDataResponse] = await Promise.all([
        fetchLocalEvents(),
        callGoogleScript('getGroupVotesAndWeights', { groupCode })
    ]);

    hideLoader();

    if (!eventsResponse.success || !groupDataResponse.success) {
        displayMessage('Fehler beim Laden der Daten.', 'error', 'message-container-results');
        return;
    }

    const events = eventsResponse.events;
    const votes = groupDataResponse.votes;
    const weights = groupDataResponse.weights;

    // Check how many users have voted
    let uniqueUsers = new Set();
    votes.forEach(v => uniqueUsers.add(v.username));
    
    // Check if the user wants to wait for 4 friends (could also be 5 if "Meine Freunde (4) und ich" = 5)
    // We will assume 4 as mentioned in the prompt, or allow processing anyway if requested?
    // Let's show a prominent message if less than 4 users have finished
    if (uniqueUsers.size < 4) {
        displayMessage(`Warte auf deine Gruppe! Bisher haben nur ${uniqueUsers.size} von 4 Personen abgestimmt.`, 'info', 'message-container-results', 0);
        // We can still show intermediate results!
    } else {
        displayMessage('Alle 4 Personen haben abgestimmt! Der finale Master-Plan ist bereit.', 'success', 'message-container-results', 5000);
    }

    // Calculate Raw Stats
    let eventScores = {};
    events.forEach(e => eventScores[e.id] = { 
        id: e.id, title: e.title, event: e, 
        baseScore: 0, weightScore: 0, totalScore: 0,
        proUsers: [], conUsers: [], userWeights: {}
    });

    votes.forEach(v => {
        if (v.score === 1) {
            eventScores[v.eventId].baseScore += 1;
            eventScores[v.eventId].proUsers.push(v.username);
        }
        if (v.score === -1) {
            eventScores[v.eventId].baseScore -= 1;
            eventScores[v.eventId].conUsers.push(v.username);
        }
    });

    weights.forEach(w => {
        if (!eventScores[w.eventId]) return;
        eventScores[w.eventId].weightScore += w.weight;
        eventScores[w.eventId].userWeights[w.username] = w.weight;
    });

    events.forEach(e => {
        // formula for total score: base yes/no + sum of weights
        eventScores[e.id].totalScore = eventScores[e.id].baseScore + (eventScores[e.id].weightScore * 2); 
    });

    let rankedEvents = Object.values(eventScores).sort((a,b) => b.totalScore - a.totalScore);

    // Render Raw Stats
    let rawHtml = `<h3>Beliebteste Veranstaltungen</h3><ul id="results-list">`;
    rankedEvents.slice(0, 10).forEach(r => {
        if(r.totalScore > 0) {
            rawHtml += `<li><strong>${r.title}</strong><br><span style="color:var(--accent-cyan)">Score: ${r.totalScore}</span></li>`;
        }
    });
    rawHtml += `</ul><hr style="border:0; height:1px; background:rgba(0,255,255,0.2); margin:20px 0;">`;

    // --- ALGORITHM ---
    // Generate Schedules
    let generatedSchedules = generateSchedules(events, eventScores);

    let schedHtml = `<h3>Top 5 Vorgeschlagene Zeitpläne (Auto-Scheduler)</h3>`;
    generatedSchedules.forEach((sched, index) => {
        schedHtml += `<div class="schedule-card">
            <h4>Option ${index + 1} <span style="font-size:0.8em; color:var(--text-muted)">(Score: ${sched.totalScore})</span></h4>
            <ul style="list-style:none; padding:0;">`;
        
        let sortedItems = sched.items.sort((a,b) => {
            const timeA = a.start.split(':').map(Number);
            const timeB = b.start.split(':').map(Number);
            // Adjust for night times (e.g. 01:00 should come after 23:00)
            const getMins = (t) => (t[0] < 12 ? t[0] + 24 : t[0]) * 60 + t[1];
            return getMins(timeA) - getMins(timeB);
        });
        
        sortedItems.forEach(item => {
            const evData = eventScores[item.event.id];
            
            // Format Pro/Con Details
            let proText = evData.proUsers.map(u => {
                let w = evData.userWeights[u];
                return w ? `${u} (${w}★)` : u;
            }).join(', ');
            
            let conText = evData.conUsers.join(', ');
            
            let voteInfo = '';
            if (proText) voteInfo += `<span style="color: var(--accent-green);">Pro: ${proText}</span>`;
            if (conText) voteInfo += (voteInfo ? ' | ' : '') + `<span style="color: var(--accent-red);">Contra: ${conText}</span>`;

            schedHtml += `<li style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <strong style="color:var(--accent-cyan)">${item.start} - ${item.end}</strong>: <span style="font-weight:500;">${item.event.title}</span> 
                <br><em style="color:var(--text-muted); font-size:0.9em;">📍 ${item.event.location} [Typ: ${item.event.type}]</em>
                <br><small>${voteInfo}</small>
            </li>`;
        });
        
        // Find left-out events
        let includedEventIds = new Set(sched.items.map(i => i.event.id));
        let leftOut = Object.values(eventScores)
            .filter(e => e.totalScore > 0 && !includedEventIds.has(e.id))
            .sort((a,b) => b.totalScore - a.totalScore);
            
        if (leftOut.length > 0) {
            schedHtml += `<hr><li style="opacity: 0.7;"><strong>Nicht aufgenommen (Trotz Votes):</strong><br>`;
            let leftOutTexts = leftOut.slice(0, 8).map(e => `${e.title} (Score: ${e.totalScore})`);
            schedHtml += `<small>${leftOutTexts.join(', ')} ...</small></li>`;
        }
        
        schedHtml += `</ul></div>`;
    });

    resultsList.innerHTML = rawHtml + schedHtml;

    // Helper to generate schedules
    function generateSchedules(allEvents, scoresDict) {
        // filter out events with non-positive total score
        let candidateEvents = allEvents.filter(e => scoresDict[e.id].totalScore > 0);
        // sort by score descending
        candidateEvents.sort((a,b) => scoresDict[b.id].totalScore - scoresDict[a.id].totalScore);
        
        // Separate top events as priority, others as fillers
        let priorityEvents = candidateEvents.slice(0, 25);
        let fillerEvents = candidateEvents.slice(25, 75); // Check up to 50 fillers

        function parseTime(tStr) {
            const [h, m] = tStr.split(':').map(Number);
            return (h < 12 ? h + 24 : h) * 60 + m; // shift after midnight to next day
        }

        function checkOverlap(ts1, ts2) {
            return parseTime(ts1.start) < parseTime(ts2.end) && parseTime(ts1.end) > parseTime(ts2.start);
        }

        function hasOverlap(schedule, nextSlot) {
            for (let item of schedule) {
                if (checkOverlap(item, nextSlot)) return true;
            }
            return false;
        }

        // --- Beam Search for Priority Events ---
        const BEAM_WIDTH = 100;
        let states = [ { items: [], totalScore: 0 } ];

        for (let ev of priorityEvents) {
            let evScore = scoresDict[ev.id].totalScore;
            let nextStates = [];

            for (let state of states) {
                // Option A: Skip this event
                nextStates.push({ 
                    items: [...state.items], 
                    totalScore: state.totalScore 
                });

                // Option B: Schedule this event in one of its valid slots
                // Dies erfüllt Regel 2: Die Führungs-Logik testet jeden Zeitslot für Touren
                for (let ts of ev.timeSlots) {
                    if (!hasOverlap(state.items, ts)) {
                        nextStates.push({
                            items: [...state.items, { event: ev, start: ts.start, end: ts.end, isFiller: false }],
                            totalScore: state.totalScore + evScore
                        });
                    }
                }
            }
            
            // Remove duplicates by signature
            let uniqueStates = [];
            let signatures = new Set();
            for (let ns of nextStates) {
                let sig = ns.items.map(i => i.event.id + "@" + i.start).sort().join("|");
                if (!signatures.has(sig)) {
                    signatures.add(sig);
                    uniqueStates.push(ns);
                }
            }

            // Sort and keep top states
            uniqueStates.sort((a,b) => b.totalScore - a.totalScore);
            states = uniqueStates.slice(0, BEAM_WIDTH);
        }

        // We now have the best partial schedules. Grab the top 10 distinct schedules.
        let topSchedules = states.slice(0, 10);
        
        // --- Regel 3: Lückenfüller ---
        // Fill gaps in the top schedules with remaining events
        for (let sched of topSchedules) {
            for (let filler of fillerEvents) {
                let fScore = scoresDict[filler.id].totalScore;
                for (let ts of filler.timeSlots) {
                    if (!hasOverlap(sched.items, ts)) {
                        sched.items.push({ event: filler, start: ts.start, end: ts.end, isFiller: true });
                        sched.totalScore += fScore;
                        break; // Only add this filler once
                    }
                }
            }
        }
        
        // Re-sort because fillers might have changed the relative ordering
        topSchedules.sort((a,b) => b.totalScore - a.totalScore);
        
        return topSchedules.slice(0, 5);
    }
});
