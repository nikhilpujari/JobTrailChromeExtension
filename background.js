// background.js

// A helper function to do a fresh fetch & analysis (no storage).
async function doFetchAnalysis() {
    // 1. Get the user's email (requires "identity.email" permission).
    const userInfo = await new Promise((resolve) => {
      chrome.identity.getProfileUserInfo((info) => {
        resolve(info);
      });
    });
  
    // 2. Get an OAuth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, function(t) {
        if (chrome.runtime.lastError || !t) {
          reject(chrome.runtime.lastError?.message);
        } else {
          resolve(t);
        }
      });
    });
  
    // 3. Fetch up to 500 inbox messages
    const query = "in:inbox";
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`,
      { headers: { Authorization: "Bearer " + token } }
    );
    const data = await response.json();
  
    if (!data.messages || data.messages.length === 0) {
      return {
        authorizedEmail: userInfo.email || "",
        analysis: null
      };
    }
  
    // 4. For each message, fetch metadata to check snippet & subject
    const jobMessages = [];
    await Promise.all(
      data.messages.map(async (message) => {
        const msgResp = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata`,
          { headers: { Authorization: "Bearer " + token } }
        );
        const msg = await msgResp.json();
  
        // If snippet or subject has "application", treat as job application
        const snippetLower = msg.snippet ? msg.snippet.toLowerCase() : "";
        let subjectMatch = false;
        if (msg.payload && msg.payload.headers) {
          const subjectHeader = msg.payload.headers.find(
            (h) => h.name.toLowerCase() === "subject"
          );
          if (subjectHeader && subjectHeader.value) {
            const subjectLower = subjectHeader.value.toLowerCase();
            subjectMatch =
              subjectLower.includes("job application") ||
              subjectLower.includes("application");
          }
        }
        if (snippetLower.includes("application") || subjectMatch) {
          jobMessages.push(msg);
        }
      })
    );
  
    // 5. Analyze the filtered jobMessages
    const analysis = analyzeApplications(jobMessages);
  
    // Return both the authorized user’s email & the analysis
    return {
      authorizedEmail: userInfo.email || "",
      analysis
    };
  }
  
  // Analyzes messages by counting total applications, grouping by month,
  // and calculating average per day.
  function analyzeApplications(messages) {
    if (!messages || messages.length === 0) {
      return null;
    }
  
    const applicationDates = [];
    messages.forEach((msg) => {
      if (msg.internalDate) {
        applicationDates.push(new Date(parseInt(msg.internalDate)));
      }
    });
  
    const totalApplications = applicationDates.length;
    const monthlyCount = {};
  
    applicationDates.forEach((date) => {
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = `${year}-${month < 10 ? "0" + month : month}`;
      monthlyCount[key] = (monthlyCount[key] || 0) + 1;
    });
  
    let averagePerDay = 0;
    if (applicationDates.length > 0) {
      applicationDates.sort((a, b) => a - b);
      const firstDate = applicationDates[0];
      const lastDate = applicationDates[applicationDates.length - 1];
      const diffTime = lastDate - firstDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      averagePerDay = totalApplications / diffDays;
    }
  
    return { totalApplications, monthlyCount, averagePerDay };
  }
  
  // Listen for popup messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "triggerAnalysis") {
      // We do NOT store anything in chrome.storage. It's ephemeral.
      doFetchAnalysis()
        .then((result) => {
          sendResponse(result); // {authorizedEmail, analysis}
        })
        .catch((err) => {
          console.error("Analysis error:", err);
          sendResponse({ authorizedEmail: "", analysis: null });
        });
      return true; // Keep channel open for async
    }
  });
  