// background.js

/*************************************************************
 * 1) KEYWORDS & HELPERS
 * 
 * We define a list of keywords/phrases that strongly suggest
 * a job application email. We then provide a helper to check
 * if any of these keywords appear in a given text.
 *************************************************************/
const jobKeywords = [
    "application",
    "applied",
    "applying",
    "application submitted",
    "thank you for applying",
    "thanks for applying",
    "we have received your application",
    "your application for",
    "submission to",
    "submitted to"
  ];
  
  // Checks if any jobKeywords appear in the given text.
  function isJobApplication(text) {
    const lower = text.toLowerCase();
    return jobKeywords.some((keyword) => lower.includes(keyword));
  }
  
  /*************************************************************
   * 2) ANALYSIS FUNCTION
   * 
   * Counts total job applications, organizes by month, computes
   * average per day, and (optionally) "today's applications."
   *************************************************************/
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
  
    // Count how many apps per YYYY-MM
    applicationDates.forEach((date) => {
      const month = date.getMonth() + 1; // 0-based in JS
      const year = date.getFullYear();
      const key = `${year}-${month < 10 ? "0" + month : month}`;
      monthlyCount[key] = (monthlyCount[key] || 0) + 1;
    });
  
    // Average per day
    let averagePerDay = 0;
    if (applicationDates.length > 0) {
      applicationDates.sort((a, b) => a - b);
      const firstDate = applicationDates[0];
      const lastDate = applicationDates[applicationDates.length - 1];
      const diffTime = lastDate - firstDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      averagePerDay = totalApplications / diffDays;
    }
  
    // (Optional) Count how many arrived "today" 
    // (If you want to show "Today's Applications" in your UI)
    /*
    let todaysCount = 0;
    const now = new Date();
    applicationDates.forEach((date) => {
      if (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      ) {
        todaysCount++;
      }
    });
    */
  
    return {
      totalApplications,
      monthlyCount,
      averagePerDay,
      // todaysCount, // uncomment if you want "today's applications"
    };
  }
  
  /*************************************************************
   * 3) FETCH & ANALYZE WITH A GIVEN TOKEN
   * 
   * This helper uses a provided OAuth token to:
   *  - Fetch user info (email) from the userinfo endpoint
   *  - Fetch up to 500 Gmail inbox messages
   *  - Filter those that look like job application emails
   *  - Analyze them (counts, monthly breakdown, etc.)
   *************************************************************/
  async function doFetchAnalysisWithToken(token) {
    let userEmail = "";
  
    // 1) Fetch user info
    try {
      const userinfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userinfo = await userinfoResp.json();
      console.log("Fetched user info:", userinfo);
      userEmail = userinfo.email || "";
    } catch (err) {
      console.error("Could not fetch user info:", err);
    }
  
    // 2) Fetch up to 500 inbox messages
    const query = "in:inbox";
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
  
    if (!data.messages || data.messages.length === 0) {
      return {
        authorizedEmail: userEmail,
        analysis: null
      };
    }
  
    // 3) Filter out messages referencing job-application keywords
    const jobMessages = [];
    await Promise.all(
      data.messages.map(async (message) => {
        const msgResp = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const msg = await msgResp.json();
  
        // Extract snippet & subject
        const snippet = msg.snippet || "";
        let subject = "";
        if (msg.payload && msg.payload.headers) {
          const subjectHeader = msg.payload.headers.find(
            (h) => h.name.toLowerCase() === "subject"
          );
          if (subjectHeader && subjectHeader.value) {
            subject = subjectHeader.value;
          }
        }
  
        // Check snippet or subject for any jobKeywords
        if (isJobApplication(snippet) || isJobApplication(subject)) {
          jobMessages.push(msg);
        }
      })
    );
  
    // 4) Analyze the filtered jobMessages
    const analysis = analyzeApplications(jobMessages);
    return { authorizedEmail: userEmail, analysis };
  }
  
  /*************************************************************
   * 4) FETCH & ANALYZE USING THE CURRENTLY CACHED ACCOUNT
   * 
   * This function obtains a token from chrome.identity.getAuthToken,
   * then calls doFetchAnalysisWithToken.
   *************************************************************/
  async function doFetchAnalysis() {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (t) => {
        if (chrome.runtime.lastError || !t) {
          reject(chrome.runtime.lastError?.message);
        } else {
          resolve(t);
        }
      });
    });
    // Now analyze with that token
    const result = await doFetchAnalysisWithToken(token);
    console.log("Returning final result (current account):", result);
    return result;
  }
  
  /*************************************************************
   * 5) MESSAGE HANDLER
   * 
   * Listens for messages from popup.js:
   *  - "triggerAnalysis": run doFetchAnalysis
   *  - "switchAccount": force user to pick a new account with
   *    launchWebAuthFlow (prompt=select_account), then analyze
   *    with the new token.
   *************************************************************/
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "triggerAnalysis") {
      // Normal analysis with the cached account
      doFetchAnalysis()
        .then((result) => {
          console.log("Sending analysis to popup:", result);
          sendResponse(result);
        })
        .catch((err) => {
          console.error("Analysis error:", err);
          sendResponse({ authorizedEmail: "", analysis: null });
        });
      return true; // Keep message channel open for async
  
    } else if (message.type === "switchAccount") {
      // Force account selection with prompt=select_account
      const redirectUri = chrome.identity.getRedirectURL();
      // Use the client ID from your Web Application in Google Cloud
      const clientId = "64302395135-kn5jviqn44m9f4duqotc18ssetj59ol5.apps.googleusercontent.com";
      const scopes = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];
      const authUrl =
        "https://accounts.google.com/o/oauth2/auth" +
        `?client_id=${clientId}` +
        `&response_type=token` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes.join(" "))}` +
        `&prompt=select_account`;
  
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            console.error("Error during account switch:", chrome.runtime.lastError);
            sendResponse({ success: false });
            return;
          }
          // Extract the new token from redirectUrl
          const m = redirectUrl.match(/access_token=([^&]+)/);
          if (m && m[1]) {
            const newToken = m[1];
            console.log("Switched account, new token:", newToken);
            // Immediately re-analyze with the new token
            try {
              const newResult = await doFetchAnalysisWithToken(newToken);
              console.log("New account analysis:", newResult);
              sendResponse({ success: true, result: newResult });
            } catch (analysisErr) {
              console.error("Error analyzing with new token:", analysisErr);
              sendResponse({ success: false });
            }
          } else {
            console.error("No token found in redirectUrl");
            sendResponse({ success: false });
          }
        }
      );
      return true;
    }
  });
  