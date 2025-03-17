document.addEventListener('DOMContentLoaded', function() {
    const analyseBtn = document.getElementById("analyseBtn");
    const resultsDiv = document.getElementById("results");
  
    analyseBtn.addEventListener("click", () => {
      resultsDiv.innerHTML = "<p>Loading...</p>";
  
      chrome.runtime.sendMessage({ type: "triggerAnalysis" }, (response) => {
        const { authorizedEmail, analysis } = response;
        
        // Always show which account was used
        let headerHTML = `<p><strong>Analysis for:</strong> ${authorizedEmail || "unknown"}</p>`;
  
        if (!analysis) {
          // Means no messages found or token error
          resultsDiv.innerHTML = `
            ${headerHTML}
            <p>No data available. 
            Either no job applications found 
            or you haven't granted Gmail access 
            for this account.</p>
          `;
          return;
        }
  
        // Build monthly breakdown
        const { monthlyCount, averagePerDay } = analysis;
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
        `;
      });
    });
  });
  