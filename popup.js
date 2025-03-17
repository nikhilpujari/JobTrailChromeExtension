// popup.js

document.addEventListener("DOMContentLoaded", function() {
    const analyseBtn = document.getElementById("analyseBtn");
    const switchAccountBtn = document.getElementById("switchAccountBtn");
    const resultsDiv = document.getElementById("results");
  
    function formatNumber(num) {
      return Number.isInteger(num) ? num : num.toFixed(1);
    }
  
    function getMonthName(monthIndex) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return monthNames[monthIndex];
    }
  
    function showLoadingState() {
      resultsDiv.innerHTML = `
        <div class="loading">
          <div class="loading-pulse">Analyzing your applications...</div>
        </div>
      `;
    }
  
    function showError(message) {
      resultsDiv.innerHTML = `
        <div class="error">
          ${message}
        </div>
      `;
    }
  
    function showAnalysisResults(authorizedEmail, analysis) {
      if (!analysis) {
        resultsDiv.innerHTML = `
          <div class="card">
            <div class="analysis-header">
              <strong>Analysis for:</strong> ${authorizedEmail || "unknown"}
            </div>
            <div class="error">
              No data available. Either no job applications found or you haven't granted Gmail access.
            </div>
          </div>
        `;
        return;
      }
  
      const { monthlyCount, averagePerDay, todaysCount } = analysis;
  
      // Sort months in descending order for display
      const sortedMonths = Object.entries(monthlyCount)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, count]) => {
          const [year, monthStr] = key.split("-");
          const monthIndex = parseInt(monthStr, 10) - 1;
          return { monthName: getMonthName(monthIndex), year, count };
        });
  
      resultsDiv.innerHTML = `
        <div class="card">
          <div class="analysis-header">
            <strong>Analysis for:</strong> ${authorizedEmail}
          </div>
  
          <div class="stats-container">
            <div class="stat-item">
              <span class="stat-label">Average per Day</span>
              <span class="stat-value">${Math.round(averagePerDay)}</span>
            </div>
  
            <div class="stat-item">
              <span class="stat-label">Today's Applications</span>
              <span class="stat-value">${Math.round(todaysCount || 0)}</span>
            </div>
  
            <div class="stat-section">
              <div class="stat-section-title">Applications per Month</div>
              ${sortedMonths.map(month => `
                <div class="stat-item">
                  <span class="stat-label">${month.monthName}, ${month.year}</span>
                  <span class="stat-value">${month.count}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  
    analyseBtn.addEventListener("click", () => {
      showLoadingState();
      chrome.runtime.sendMessage({ type: "triggerAnalysis" }, (response) => {
        if (chrome.runtime.lastError) {
          showError("Failed to analyze applications. Please try again.");
          return;
        }
  
        const { authorizedEmail, analysis } = response;
        showAnalysisResults(authorizedEmail, analysis);
      });
    });
  
    switchAccountBtn.addEventListener("click", () => {
      showLoadingState();
      chrome.runtime.sendMessage({ type: "switchAccount" }, (response) => {
        if (!response || !response.success) {
          showError("Failed to switch account. Please try again.");
          return;
        }
  
        const { authorizedEmail, analysis } = response.result;
        showAnalysisResults(authorizedEmail, analysis);
      });
    });
  });