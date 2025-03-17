// popup.js

document.addEventListener("DOMContentLoaded", function() {
    const analyseBtn = document.getElementById("analyseBtn");
    const switchAccountBtn = document.getElementById("switchAccountBtn");
    const resultsDiv = document.getElementById("results");
  
    // Helper to display results in the popup
    function showAnalysisResults(authorizedEmail, analysis) {
      let headerHTML = `<p><strong>Analysis for:</strong> ${authorizedEmail || "unknown"}</p>`;
      if (!analysis) {
        resultsDiv.innerHTML = `
          ${headerHTML}
          <p>No data available. Either no job applications found 
          or you haven't granted Gmail access.</p>
        `;
        return;
      }
  
      const { monthlyCount, averagePerDay, todaysCount } = analysis;
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
  
      let monthlyResultsHTML = "";
      for (const [key, count] of Object.entries(monthlyCount)) {
        const [year, monthStr] = key.split("-");
        const monthIndex = parseInt(monthStr, 10) - 1;
        const monthName = monthNames[monthIndex] || "Unknown";
        monthlyResultsHTML += `<p>${monthName}, ${year}: ${count}</p>`;
      }
  
      resultsDiv.innerHTML = `
        ${headerHTML}
        <p><strong>Applications per Month:</strong></p>
        ${monthlyResultsHTML}
        <p><strong>Average per Day:</strong> ${Math.round(averagePerDay)}</p>
        <p><strong>Today's Applications:</strong> ${todaysCount || 0}</p>
      `;
    }
  
    // 1) Handle "Analyse My Consistency" (uses the cached/current account)
    analyseBtn.addEventListener("click", () => {
      resultsDiv.innerHTML = "<p>Loading...</p>";
      chrome.runtime.sendMessage({ type: "triggerAnalysis" }, (response) => {
        console.log("Received from background (current account):", response);
        const { authorizedEmail, analysis } = response;
        showAnalysisResults(authorizedEmail, analysis);
      });
    });
  
    // 2) Handle "Switch Account" (forces an account chooser, then re-analyzes)
    switchAccountBtn.addEventListener("click", () => {
      resultsDiv.innerHTML = "<p>Switching account...</p>";
      chrome.runtime.sendMessage({ type: "switchAccount" }, (response) => {
        if (response && response.success && response.result) {
          console.log("Switched account, new analysis result:", response.result);
          const { authorizedEmail, analysis } = response.result;
          showAnalysisResults(authorizedEmail, analysis);
        } else {
          alert("Unable to switch account or fetch new data.");
          resultsDiv.innerHTML = "";
        }
      });
    });
  });
  