document.addEventListener("DOMContentLoaded", function () {
  const API_BASE_URL = "http://localhost:3000"; // THIS MUST MATCH BACKEND PORT
  const kpiId = new URLSearchParams(window.location.search).get("id");

  // DOM elements
  const mainContent = document.getElementById("main-content");
  const cardTitle = document.querySelector(".card-title");
  const kpiTargetEl = document.getElementById("kpi-target");
  const kpiCurrentEl = document.getElementById("kpi-current"); // This will display progressNumber
  const kpiStaffEl = document.getElementById("kpi-staff");
  const kpiStatusEl = document.getElementById("kpi-status"); // This is the editable approval status
  const kpiDueDateEl = document.getElementById("kpi-dueDate");
  const timeline = document.querySelector(".timeline");

  const editBtn = document.getElementById("editToggleBtn");
  const saveBtn = document.getElementById("saveChangesBtn");
  const deleteBtn = document.getElementById("deleteBtn");

  // Initialize Bootstrap modal instance for deletion
  const deleteKpiModal = new bootstrap.Modal(document.getElementById('deleteKpiModal'));
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");


  if (!kpiId) {
    mainContent.innerHTML = `<div class="alert alert-danger mt-4">Error: No KPI ID was found in the URL.</div>`;
    return;
  }

  // --- 1. Fetch and Display KPI Details ---
  async function fetchKpiDetails() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kpis/${kpiId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const kpi = await response.json();

      // Populate the static fields
      cardTitle.textContent = kpi.title;
      document.title = kpi.title; // Update the page title
      kpiTargetEl.textContent = kpi.targetValue;
      kpiCurrentEl.textContent = kpi.progressNumber; // Display the actual progress number
      kpiStaffEl.textContent = kpi.assignedTo ? kpi.assignedTo.name : 'N/A';
      kpiStatusEl.textContent = kpi.approvalstat; // Display the approval status for the static view
      kpiDueDateEl.textContent = new Date(kpi.dueDate).toISOString().split('T')[0]; // Format date to YYYY-MM-DD

      // Revert inputs to static text if they were in edit mode
      // This ensures that after save/fetch, the display is always correct
      kpiTargetEl.innerHTML = kpi.targetValue;
      kpiDueDateEl.innerHTML = new Date(kpi.dueDate).toISOString().split('T')[0];
      kpiStatusEl.innerHTML = kpi.approvalstat; // Static text for approvalstat

      // Populate the evidence timeline
      timeline.innerHTML = "";
      if (kpi.evidence && kpi.evidence.length > 0) {
        kpi.evidence.forEach(evi => {
          // Assuming evi.status exists on the evidence object itself
          const statusColor = evi.status === "Approved" ? "success" : evi.status === "Rejected" ? "danger" : "warning text-dark";
          timeline.innerHTML += `
            <li>
              <div class="timeline-badge"><i class="fas fa-upload"></i></div>
              <div class="timeline-panel">
                <div class="timeline-heading"><h6 class="timeline-title">${new Date(evi.date).toLocaleDateString()}</h6></div>
                <div class="timeline-body">
                  <p><strong>Progress:</strong> ${evi.description}</p>
                  <p>
                    <a href="${evi.status === "Pending" ? `manager-view-evidence.html?id=${kpi._id}&evidenceId=${evi._id}` : "#"}">📄 ${evi.file}</a>
                    - <span class="badge bg-${statusColor}">${evi.status}</span>
                  </p>
                </div>
              </div>
            </li>
          `;
        });
      } else {
        timeline.innerHTML = '<li><div class="timeline-panel"><p>No evidence has been submitted yet.</p></div></li>';
      }

      // Ensure buttons are in correct state after fetch
      saveBtn.classList.add("d-none");
      editBtn.classList.remove("d-none");

    } catch (error) {
      console.error("Error fetching KPI details:", error);
      mainContent.innerHTML = `<div class="alert alert-danger mt-4">Failed to load KPI details. Please ensure the backend server is running and the ID is correct.</div>`;
    }
  }

  // --- 2. Edit and Save Logic ---
  editBtn.addEventListener("click", function () {
    // Capture current displayed values before turning into inputs
    const originalTarget = kpiTargetEl.textContent.trim();
    const originalApprovalStatus = kpiStatusEl.textContent.trim(); // This is the approvalstat
    const originalDueDate = kpiDueDateEl.textContent.trim();

    // Convert elements to input fields
    kpiTargetEl.innerHTML = `<input type="number" class="form-control form-control-sm d-inline-block w-auto" id="kpi-target-input" value="${originalTarget}" />`;
    kpiDueDateEl.innerHTML = `<input type="date" class="form-control form-control-sm d-inline-block w-auto" id="kpi-dueDate-input" value="${originalDueDate}" />`;
    // This dropdown is for `approvalstat` (Pending, Approved, Rejected, No New Progress)
    kpiStatusEl.innerHTML = `
      <select class="form-select form-select-sm d-inline-block w-auto" id="kpi-status-input">
          <option value="Pending" ${originalApprovalStatus === "Pending" ? "selected" : ""}>Pending</option>
          <option value="Approved" ${originalApprovalStatus === "Approved" ? "selected" : ""}>Approved</option>
          <option value="Rejected" ${originalApprovalStatus === "Rejected" ? "selected" : ""}>Rejected</option>
          <option value="No New Progress" ${originalApprovalStatus === "No New Progress" ? "selected" : ""}>No New Progress</option>
      </select>`;

    // Toggle button visibility
    editBtn.classList.add("d-none");
    saveBtn.classList.remove("d-none");
  });

  saveBtn.addEventListener("click", async function () {
    const updatedTargetValue = document.getElementById("kpi-target-input").value;
    const updatedDueDate = document.getElementById("kpi-dueDate-input").value;
    const updatedApprovalStatus = document.getElementById("kpi-status-input").value; // This value is for approvalstat

    try {
      const response = await fetch(`${API_BASE_URL}/api/kpis/${kpiId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetValue: parseInt(updatedTargetValue), // Ensure it's a number
          dueDate: updatedDueDate,
          status: updatedApprovalStatus, // Backend's updateKpi will map this to `approvalstat`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}. Message: ${errorData.msg || 'Unknown error'}`);
      }

      // Re-fetch to update displayed details and revert inputs
      await fetchKpiDetails();

      // Display success message (using a simple alert for now, consider a custom modal)
      alert("KPI updated successfully!");

    } catch (error) {
      console.error("Error saving KPI details:", error);
      alert(`Failed to save KPI details. ${error.message || ''} Please try again.`);
    }
  });

  // --- 3. Delete Logic ---
  deleteBtn.addEventListener("click", function() {
    deleteKpiModal.show(); // Show the confirmation modal
  });

  confirmDeleteBtn.addEventListener("click", async function() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kpis/${kpiId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}. Message: ${errorData.msg || 'Unknown error'}`);
      }

      alert("KPI deleted successfully!");
      window.location.href = "manager-view-assigned-kpi.html"; // Redirect after deletion

    } catch (error) {
      console.error("Error deleting KPI:", error);
      alert(`Failed to delete KPI. ${error.message || ''} Please try again.`);
    } finally {
      deleteKpiModal.hide(); // Hide the modal whether successful or not
    }
  });


  // Initial render when the page loads
  fetchKpiDetails();
});