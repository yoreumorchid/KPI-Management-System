 //--- DELETED: getStoredKpis function (no longer needed with backend) ---
// function getStoredKpis() {
//   return JSON.parse(localStorage.getItem("kpis")) || [];
// }

// DOM elements
const kpiCardsContainer = document.getElementById("kpiCardsContainer");
const filterStaff = document.getElementById("filterStaff");
const filterDepartment = document.getElementById("filterDepartment");
const filterStatus = document.getElementById("filterStatus");

// Base URL for your backend API
const API_BASE_URL = "http://localhost:3000"; // THIS MUST MATCH BACKEND PORT

// Function to fetch KPIs from the backend
async function fetchKpis(filters = {}) {
  let url = `${API_BASE_URL}/api/kpis`;
  const params = new URLSearchParams();

  // Your backend filters for staffName, department, and status should align
  // with the field names in your KPI schema or how your backend is handling filtering.
  // Assuming your backend expects 'assignedTo.name', 'assignedTo.department', and 'status'.
  // We'll pass the filter values as they are, backend needs to map them.
  if (filters.staffName) {
    params.append("staffName", filters.staffName);
  }
  if (filters.department) {
    params.append("department", filters.department);
  }
  if (filters.status) {
    params.append("status", filters.status);
  }

  if (params.toString()) {
    url += `?${params.toString()}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const kpis = await response.json();
    renderCards(kpis);
  } catch (error) {
    console.error("Error fetching KPIs:", error);
    kpiCardsContainer.innerHTML = `
      <div class="col-12 text-center mt-4">
        <p class="text-danger">Failed to load KPIs. Please try again later.</p>
      </div>
    `;
  }
}

// Render KPI cards (remains largely the same, but now receives data from fetchKpis)
function renderCards(kpis) {
  kpiCardsContainer.innerHTML = "";

  if (kpis.length === 0) {
    kpiCardsContainer.innerHTML = `
      <div class="col-12 text-center mt-4">
        <p class="text-muted">No KPIs match the selected filters.</p>
      </div>
    `;
    return;
  }

  kpis.forEach((kpi) => {
    const card = document.createElement("div");
    card.className = "col-md-6 col-lg-4 mb-4";

    // Automatically set status to "Completed" if progressNumber equals targetValue
    let progressText = "";
    let progressPercentage = 0;

    if (kpi.progressNumber === kpi.targetValue) {
      progressText = "Completed";
      progressPercentage = 100;
    } else if (kpi.progressNumber > 0 && kpi.progressNumber < kpi.targetValue) {
      progressText = "In Progress";
      progressPercentage = (kpi.progressNumber / kpi.targetValue) * 100;
      if (isNaN(progressPercentage) || !isFinite(progressPercentage)) {
        progressPercentage = 0;
      }
    } else if (kpi.progressNumber === 0) {
      progressText = "Not Started";
      progressPercentage = 0;
    } else {
      progressText = "N/A";
      progressPercentage = 0;
    }

    progressPercentage = Math.round(progressPercentage);

    card.innerHTML = `
      <div class="card h-100 shadow-sm">
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <h5 class="card-title">
              <a href="manager-kpi-detail.html?id=${kpi._id}" class="text-decoration-none text-primary">
                ${kpi.title}
              </a>
            </h5>
            <p class="card-text"><strong>Description:</strong> ${kpi.description}</p>
            <p class="card-text"><strong>Staff:</strong> ${kpi.assignedTo ? kpi.assignedTo.name : 'Unassigned'}</p>
            <p class="card-text"><strong>Department:</strong> ${kpi.assignedTo ? kpi.assignedTo.department : 'N/A'}</p>
            <p class="card-text"><strong>Target:</strong> ${kpi.targetValue}</p>
            <p class="card-text"><strong>CurrentProgress:</strong> ${kpi.progressNumber}</p>
            <p class="card-text"><strong>Due Date:</strong> ${new Date(kpi.dueDate).toLocaleDateString()}</p>
            <p class="card-text"><strong>Indicators:</strong> ${kpi.target}</p>
            <p class="card-text"><strong>Progress:</strong> ${progressText}</p>
            <div class="progress" style="height: 20px;">
              <div class="progress-bar" role="progressbar" aria-valuenow="${progressPercentage}" aria-valuemin="0" aria-valuemax="100" style="width: ${progressPercentage}%;"></div>
            </div>
          </div>
          <div class="mt-3 d-flex align-items-center">
            ${kpi.approvalstat === "Pending"
              ? `<a href="manager-view-evidence.html?id=${kpi._id}" class="btn btn-sm btn-outline-primary me-auto">Review</a>`
              : `<span class="me-auto"></span>`
            }
            <span class="badge bg-${getStatusColor(kpi.approvalstat)}">${kpi.approvalstat}</span>
          </div>
        </div>
      </div>
    `;
    kpiCardsContainer.appendChild(card);
  });
}

// Determine status color for approvalstat
function getStatusColor(approvalstat) {
  switch (approvalstat?.toLowerCase()) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "pending":
      return "warning text-dark"; // text-dark ensures good contrast on yellow
    default:
      return "secondary";
  }
}

// Filter logic
function applyFilters() {
  const staff = filterStaff.value;
  const department = filterDepartment.value;
  const status = filterStatus.value; // Corresponds to the 'status' field in your KPI model

  fetchKpis({
    staffName: staff,
    department: department,
    status: status // Use 'status' as the filter parameter name
  });
}

// Add event listeners
[filterStaff, filterDepartment, filterStatus].forEach((input) => {
  input.addEventListener("change", applyFilters);
});

// Initial render by fetching from backend when the page loads
document.addEventListener("DOMContentLoaded", fetchKpis);

// Function to populate a dropdown with options
function populateDropdown(selectElement, items, idField, nameField) {
  selectElement.innerHTML = '<option value="">All</option>'; // Add a default "All" option
  items.forEach(item => {
    const option = document.createElement('option');
    // Ensure this line correctly sets the value to the ID
    option.value = idField ? item[idField] : item;
    // Ensure this line sets the visible text to the name
    option.textContent = nameField ? item[nameField] : item;
    selectElement.appendChild(option);
  });
}

// Function to fetch unique departments and populate the dropdown
async function fetchAndPopulateDepartments() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/departments`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const departments = await response.json();
    populateDropdown(filterDepartment, departments); // No ID/Name field needed for simple strings
  } catch (error) {
    console.error("Error fetching departments:", error);
    // Optionally display an error message for the user
  }
}

// Function to fetch staff members and populate the dropdown
async function fetchAndPopulateStaff() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/staff`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const staff = await response.json();
    // Assuming staff array contains objects like { _id: '...', name: '...', email: '...' }
    populateDropdown(filterStaff, staff, '_id', 'name'); // Use _id as value, name as text
  } catch (error) {
    console.error("Error fetching staff:", error);
    // Optionally display an error message for the user
  }
}

// Add event listeners (existing code)
[filterStaff, filterDepartment, filterStatus].forEach((input) => {
  input.addEventListener("change", applyFilters);
});

// Initial render and populate filters when the page loads
document.addEventListener("DOMContentLoaded", () => {
  fetchKpis(); // Fetch and render KPI cards
  fetchAndPopulateDepartments(); // Populate department filter
  fetchAndPopulateStaff(); // Populate staff filter
});