const fs = require('fs');
const content = fs.readFileSync('Programmheft.md', 'utf-8');

const events = [];
let eventId = 1;

// 1. Tour Parsing
const toursSectionMatch = content.split('# Führungen Führungen');
if (toursSectionMatch.length > 1) {
    const toursSection = toursSectionMatch[1];
    const tourBlocks = toursSection.split('#### ').slice(1);
    for (let block of tourBlocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('```') && !l.startsWith('Hinweis'));
        if (lines.length < 3) continue;
        const title = lines[0];
        const location = lines[1];
        
        let timesLine = '';
        let detailsLine = '';
        for(let i=2; i<lines.length; i++) {
            if(lines[i].includes('Personen') || lines[i].includes('Minuten') || lines[i].includes('Treffpunkt')) {
                detailsLine = lines[i];
            } else if (lines[i].match(/\d{1,2}:/)) {
                timesLine += lines[i] + ' ';
            }
        }
        
        const timeRegex = /([0-2]?\d):(?:([0-5]\d))?/g;
        let match;
        let startTimes = [];
        while ((match = timeRegex.exec(timesLine)) !== null) {
            let hour = match[1];
            let min = match[2] || '00';
            if (hour.length === 1) hour = '0' + hour;
            startTimes.push(`${hour}:${min}`);
        }
        
        // Duration
        const minRegex = /(\d+)\s*Minuten/;
        let durationMatch = minRegex.exec(detailsLine);
        let durationMins = durationMatch ? parseInt(durationMatch[1]) : 45;
        
        const timeSlots = startTimes.map(st => {
            let [h, m] = st.split(':').map(Number);
            let endM = m + durationMins;
            let endH = h + Math.floor(endM / 60);
            endM = endM % 60;
            if(endH >= 24) endH -= 24;
            let endTime = String(endH).padStart(2,'0') + ':' + String(endM).padStart(2,'0');
            return { start: st, end: endTime };
        });
        
        if (timeSlots.length > 0) {
            events.push({
                id: eventId++,
                title: title.trim(),
                type: 'Tour',
                location: location.trim(),
                timeSlots: timeSlots
            });
        }
    }
}

// 2. Lecture Parsing
// The layout is complex:
// ## OSZ H1 OSZ H2 OSZ H(3?)
// #### 18:
// #### –
// #### 19:
// Fach1 Fach2 Fach3
// Vorname Nachname \n Titel \n ... repeated for each column

const lecturesSection = content.split('# Vorträge Vorträge')[1].split('# Führungen Führungen')[0];

const roomLines = lecturesSection.match(/## (.*)/g);
let rooms = [];
if (roomLines) {
    // Collect rooms from the "## OSZ H1 OSZ H2 OSZ H3" lines
    const lastRoomLine = roomLines[roomLines.length-1].replace('##', '').trim();
    if (lastRoomLine.includes('OSZ H1')) rooms = ['OSZ H1', 'OSZ H2', 'OSZ H3', 'OSZ H4', 'OSZ H5', 'OSZ H6']; // Fallback
}
rooms = ['OSZ H1', 'OSZ H2', 'OSZ H3', 'OSZ H4', 'OSZ H5', 'OSZ H6']; // Often the case in NoS

const timeBlocks = lecturesSection.split(/#### (\d{1,2}:)\s*#### –\s*#### (\d{1,2}:)/);

for (let i = 1; i < timeBlocks.length; i += 3) {
    const startHourStr = timeBlocks[i].replace(':', '').trim();
    const endHourStr = timeBlocks[i+1].replace(':', '').trim();
    
    let startHour = parseInt(startHourStr);
    let endHour = parseInt(endHourStr);
    
    if (endHour <= startHour && startHour !== 23) {
        endHour = startHour + 1;
    }
    
    let startTime = String(startHour).padStart(2,'0') + ':00';
    let endTime = String(endHour).padStart(2,'0') + ':00';
    if (startHour === 0) startTime = '00:00';
    if (endHour === 0) endTime = '00:00';
    if (endHour === 1) endTime = '01:00';
    if (endHour === 2) endTime = '02:00';
    if (endHour === 3) endTime = '03:00';

    const contentBlock = timeBlocks[i+2];
    
    // Split into chunks delimited by ```
    const chunks = contentBlock.split('```').map(x => x.trim()).filter(x => x);
    
    // Usually the first chunk is the disciplines: "Mathematik Physik Pharmazie" (ignore it)
    // Actually chunks often are single lecture boxes.
    chunks.forEach((chunk, index) => {
        // Discard lists of subjects
        if (chunk.includes('Mathematik Physik') || chunk.split('\n').length === 1) {
            // Check if it's actually an event list
            const sublines = chunk.split('\n').map(l => l.trim()).filter(l => l);
            if (sublines.length >= 2 && !sublines[0].includes('Mathematik Physik')) {
                // heuristic: first is speaker, then rest is title
                 let speaker = sublines[0];
                 let title = sublines.slice(1).join(' ');
                 if(speaker.split(' ').length <= 4) {
                    events.push({
                        id: eventId++,
                        title: title,
                        speaker: speaker,
                        type: 'Lecture',
                        location: rooms[index % 3] || 'OSZ',
                        timeSlots: [{ start: startTime, end: endTime }]
                    });
                 }
            }
        } else {
            const sublines = chunk.split('\n').map(l => l.trim()).filter(l => l);
            if (sublines.length >= 2) {
                let speaker = sublines[0];
                let title = sublines.slice(1).join(' ');
                
                // If it looks like a person's name
                if (speaker.split(' ').length <= 3 && !speaker.includes('Vortrag') && !speaker.includes('Science')) {
                    events.push({
                        id: eventId++,
                        title: title,
                        speaker: speaker,
                        type: 'Lecture',
                        location: rooms[Math.max(0, index - 1) % 3] || 'OSZ',
                        timeSlots: [{ start: startTime, end: endTime }]
                    });
                }
            }
        }
    });
}

fs.writeFileSync('events.json', JSON.stringify(events, null, 2));
console.log('Total events parsed: ' + events.length);
