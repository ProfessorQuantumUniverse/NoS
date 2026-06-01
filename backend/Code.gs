/**
 * Google Apps Script Backend for Night of Science Scheduler
 * 
 * Sheets required:
 * - Users: GroupCode, Username, Password
 * - Votes: GroupCode, Username, EventId, Score
 * - Weights: GroupCode, Username, EventId, Weight
 */

function doPost(e) {
  let result = { success: false, message: 'Unknown error' };
  try {
    const payload = JSON.parse(e.postData.contents);
    
    switch (payload.action) {
      
      case 'validateLogin':
        result = validateLogin(payload.groupCode, payload.username, payload.password);
        break;
      case 'recordVote':
        result = recordVote(payload.groupCode, payload.username, payload.eventId, payload.score);
        break;
      case 'getUserVotes':
        result = getUserVotes(payload.groupCode, payload.username);
        break;
      case 'recordWeights':
        result = recordWeights(payload.groupCode, payload.username, payload.weights);
        break;
      case 'getGroupVotesAndWeights':
        result = getGroupVotesAndWeights(payload.groupCode);
        break;
      case 'getGroupStatus':
        result = getGroupStatus(payload.groupCode);
        break;
      case 'setUserPhase':
        result = setUserPhase(payload.groupCode, payload.username, payload.phase);
        break;
      default:
        result = { success: false, message: 'Unknown action' };
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetByName(name) {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "Users") sheet.appendRow(["GroupCode", "Username", "Password", "Phase1Done", "Phase2Done"]);
    if (name === "Votes") sheet.appendRow(["GroupCode", "Username", "EventId", "Score"]);
    if (name === "Weights") sheet.appendRow(["GroupCode", "Username", "EventId", "Weight"]);
  }
  return sheet;
}

function validateLogin(groupCode, username, password) {
  const sheet = getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  // Find user
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupCode && data[i][1] === username) {
      if (data[i][2] === password) {
        return { success: true };
      }
      return { success: false, message: "Falsches Passwort" };
    }
  }
  
  // User not found, register them
  sheet.appendRow([groupCode, username, password]);
  return { success: true, message: "Benutzer registriert" };
}

function recordVote(groupCode, username, eventId, score) {
  const sheet = getSheetByName("Votes");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupCode && data[i][1] === username && data[i][2] == eventId) {
      sheet.getRange(i + 1, 4).setValue(score);
      return { success: true };
    }
  }
  
  sheet.appendRow([groupCode, username, eventId, score]);
  return { success: true };
}

function getUserVotes(groupCode, username) {
  const sheet = getSheetByName("Votes");
  const data = sheet.getDataRange().getValues();
  let votes = {};
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupCode && data[i][1] === username) {
      votes[data[i][2]] = data[i][3];
    }
  }
  
  return { success: true, votes: votes };
}

function recordWeights(groupCode, username, weights) {
  const sheet = getSheetByName("Weights");
  const data = sheet.getDataRange().getValues();
  
  // Array format: [{eventId: 1, weight: 5}, ...]
  for (let w of weights) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === groupCode && data[i][1] === username && data[i][2] == w.eventId) {
        sheet.getRange(i + 1, 4).setValue(w.weight);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([groupCode, username, w.eventId, w.weight]);
    }
  }
  
  return { success: true };
}

function getGroupVotesAndWeights(groupCode) {
  const votesSheet = getSheetByName("Votes");
  const weightsSheet = getSheetByName("Weights");
  
  let allVotes = [];
  let votesData = votesSheet.getDataRange().getValues();
  for (let i = 1; i < votesData.length; i++) {
    if (votesData[i][0] === groupCode) {
      allVotes.push({
        username: votesData[i][1],
        eventId: votesData[i][2],
        score: votesData[i][3]
      });
    }
  }

  let allWeights = [];
  let weightsData = weightsSheet.getDataRange().getValues();
  for (let i = 1; i < weightsData.length; i++) {
    if (weightsData[i][0] === groupCode) {
      allWeights.push({
        username: weightsData[i][1],
        eventId: weightsData[i][2],
        weight: weightsData[i][3]
      });
    }
  }

  return { success: true, votes: allVotes, weights: allWeights };
}


function setUserPhase(groupCode, username, phase) {
  const sheet = getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupCode && data[i][1] === username) {
      if (phase === 1) sheet.getRange(i + 1, 4).setValue(true);
      if (phase === 2) sheet.getRange(i + 1, 5).setValue(true);
      return { success: true };
    }
  }
  return { success: false, message: "User not found" };
}

function getGroupStatus(groupCode) {
  const sheet = getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  let users = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === groupCode) {
      users.push({
        username: data[i][1],
        phase1: data[i][3] === true,
        phase2: data[i][4] === true
      });
    }
  }
  
  return { success: true, users: users };
}

