 // Configuration
    const API_URL = 'https://ess.bhagwati.co/essapps/Api/employee/GetempData'; // api
    const EXCLUDED_EMPLOYEE_CODES = ['TEMP0004','TEMP0005','TEMP0006','TEMP0007']; 
    const EXCLUDED_VENDORS = ['vendor'];

    // Global Variables
    let employeeData = [];
    let lastResult = {}, lastDisplay = {};
    let reportType = 'monthly', selectedWeek = 1, selectedDay = 1, currentView = 'dashboard';

    // Utility Functions
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

function parseDate(str) {
    if(!str || typeof str !== 'string') return null;
    const iso = Date.parse(str);
    if(!isNaN(iso)) return new Date(iso);
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(m) {
        const mm = +m[1], dd = +m[2], yy = +m[1];
        return new Date(yy, mm - 1, dd);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
    }

    const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const isInRange = (date, y, m, s, e) => date &&
    date.getFullYear() === y && 
    date.getMonth() === m && 
    date.getDate() >= s &&
    date.getDate() <= e;

function getCurrentDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
    }

    async function fetchEmployeeData() {
    try {
        if(!API_URL || API_URL === 'my api link here') {
        alert('Please set your API_URL at the top of the script.');
        return;
        }
        const res = await fetch(API_URL);
        if(!res.ok) throw new Error('API error: ' + res.status);
        const json = await res.json();

        // Normalize response
        let rawData = [];
        if(Array.isArray(json)) rawData = json;
        else if(Array.isArray(json.data)) rawData = json.data;
        else if(json && typeof json === 'object') {
        const firstVal = json[Object.keys(json)[0]];
        rawData = Array.isArray(firstVal) ? firstVal : [json];
        }

        // Api filters
        employeeData = rawData.filter(emp => {
        
        const vendor = (emp.VendorName || emp.vendorName || emp.vendor_name || '').trim().toLowerCase();
        if(EXCLUDED_VENDORS.includes(vendor)) return false;
        
        const empCode = (emp.Ecode || emp.EmployeeCode || emp.employee_code || '').trim();
        if(EXCLUDED_EMPLOYEE_CODES.includes(empCode)) return false;
        
        return true;
        });

        console.log(`Total records: ${rawData.length}, After filtering: ${employeeData.length}`);
        generateReport();
    } catch(err) {
        alert('Failed to load employee data');
        console.error(err);
    }
    }

function populateDaySelect() {
    const year = +$('#yearSelect').value;
    const month = +$('#monthSelect').value;
    const daysInSelectedMonth = daysInMonth(year, month);
    
    const daySelect = $('#daySelect');
    daySelect.innerHTML = '';
    
    for(let day = 1; day <= daysInSelectedMonth; day++) {
        daySelect.insertAdjacentHTML('beforeend', `<option value="${day}">${day}</option>`);
    }
    
    const today = new Date();
    if(year === today.getFullYear() && month === today.getMonth()) {
        const currentDay = today.getDate();
        if(currentDay <= daysInSelectedMonth) {
        daySelect.value = currentDay;
        selectedDay = currentDay;
        }
    } else {
        daySelect.value = 1;
        selectedDay = 1;
    }
    }


function generateReport() {
    const year = +$('#yearSelect').value,
        month = +$('#monthSelect').value,
        week = +$('#weekSelect').value || 1,
        day = +$('#daySelect').value || 1;

    let sDay, eDay, weekEnd;
    
    if(reportType === 'monthly') {
        sDay = 1;
        eDay = daysInMonth(year, month);
        weekEnd = new Date(year, month, eDay);
    } 
    else if(reportType === 'weekly') {
        sDay = (week - 1) * 7 + 1;
        eDay = week === 4 ? daysInMonth(year, month) : sDay + 6;
        weekEnd = new Date(year, month, eDay);
    }
    else if(reportType === 'daily') {
        sDay = day;
        eDay = day;
        weekEnd = new Date(year, month, day);
    }

    const result = {}, display = {};
    employeeData.forEach(emp => {
        const depRaw = (emp['Department Name'] || emp['Department'] || emp.DepartmentName || emp.dept || 'Unknown');
        const depTrim = (typeof depRaw === 'string') ? depRaw.trim() : String(depRaw);
        const key = depTrim.toLowerCase();
        display[key] = depTrim || 'Unknown';
        if(!result[key]) result[key] = {joined: 0, left: 0, active: 0, exception: 0};

        const doj = parseDate(emp.DOJ), dol = parseDate(emp.DOL);

        // Exception
        if(doj && dol && doj > dol && isInRange(doj, year, month, sDay, eDay)) 
            result[key].exception++;
        
        // Joined
        if(isInRange(doj, year, month, sDay, eDay)) 
            result[key].joined++;
        
        // Left
        if(isInRange(dol, year, month, sDay, eDay))
            result[key].left++;
        
        // Active
        if(doj && doj <= weekEnd && (!dol || dol > weekEnd)) 
            result[key].active++;
    });
    
    lastResult = result;
    lastDisplay = display;
    switchView(currentView, true);
    }

    // Dashboard Rendering
function renderDashboard() {
    renderStats(lastResult, lastDisplay);
    renderCharts(lastResult, lastDisplay);
    }

function renderStats(data, names) {
    let tJ = 0, tL = 0, tA = 0, tE = 0;
    for(const k in data) {
        tJ += data[k].joined;
        tL += data[k].left; tA += data[k].active; tE += data[k].exception;
    }
    const total = tA + tL,
            actP = total ? ((tA/total)*100).toFixed(1) : '0.0',
            leftP = total ? ((tL/total)*100).toFixed(1) : '0.0';

    $('#statCards').innerHTML = `
        ${card('joined', 'fa-user-plus', 'New Hires', tJ, 'joined')}
        ${card('left', 'fa-user-minus', 'Left', tL, 'left')}
        ${card('active', 'fa-users', 'Active Team', tA, 'active')}
        ${card('exception', 'fa-exclamation-triangle', 'Exceptions', tE, 'exception')}
        ${card('activePercent', 'fa-chart-pie', 'Active Rate', actP+'%', 'percent')}
        ${card('leftPercent', 'fa-chart-line', 'Attrition', leftP+'%', 'percent')}
    `;

function card(type, icon, label, val, iconClass) {
        return `<div class="bento-card" data-type="${type}">
        <div class="bento-icon ${iconClass}">
            <i class="fas ${icon}"></i>
        </div>
        <div class="bento-value">${val}</div>
        <div class="bento-label">${label}</div>
        </div>`;
    }
    }

function renderCharts(data, names) {
$('#chart-section').innerHTML = `
    <div class="chart-card-2025">
    <h3 class="chart-title-2025">Active Employees by Department</h3>
    <canvas id="actChart" height="120"></canvas>
    </div>
    <div class="chart-card-2025">
    <h3 class="chart-title-2025">Left Employees by Department</h3>
    <canvas id="leftChart" height="120"></canvas>
    </div>
    <div class="chart-card-2025">
    <h3 class="chart-title-2025">New Hires by Department</h3>
    <canvas id="joinChart" height="120"></canvas>
    </div>
`;

if(window.dashboardCharts)
    window.dashboardCharts.forEach(c => c && c.destroy());
    window.dashboardCharts = [];
const labels = Object.values(names),
        act = vals('active'), lef = vals('left'), joi = vals('joined');

  // Get theme-aware chart options
const chartOptions = getChartOptions();

window.dashboardCharts.push(
    new Chart($('#actChart'), {
    type:'bar', 
    data:{labels, datasets:[{
        data:act, 
        backgroundColor: 'rgba(0, 245, 255, 0.8)',
        borderRadius: 6,
        borderSkipped: false
    }]}, 
    options: chartOptions
    }),
    new Chart($('#leftChart'), {
    type:'bar', 
    data:{labels, datasets:[{
        data:lef, 
        backgroundColor: 'rgba(244, 114, 182, 0.8)',
        borderRadius: 6,
        borderSkipped: false
    }]}, 
    options: chartOptions
    }),
    new Chart($('#joinChart'), {
    type:'bar', 
    data:{labels, datasets:[{
        data:joi, 
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderRadius: 6,
        borderSkipped: false
    }]}, 
    options: chartOptions
    })
);
function vals(key) { return Object.values(data).map(d => d[key]); }
}


    // View Rendering Functions
function renderDepartments() {
let totalJoined = 0,
    totalLeft = 0, 
    totalActive = 0, 
    totalException = 0;

Object.values(lastResult).forEach(dept => {
    totalJoined += dept.joined;
    totalLeft   += dept.left;
    totalActive += dept.active;
    totalException += dept.exception;
});

const rows = Object.keys(lastResult).map(k => {
    const v = lastResult[k];
    return `<tr>
    <td>${lastDisplay[k]}</td>
    <td>${v.joined}</td>
    <td>${v.left}</td>
    <td>${v.active}</td>
    <td>${v.exception}</td>
    </tr>`;
}).join('');

const totalRow = `<tr class="table-total-2025">
    <td>TOTAL</td>
    <td>${totalJoined}</td>
    <td>${totalLeft}</td>
    <td>${totalActive}</td>
    <td>${totalException}</td>
</tr>`;

$('#departmentsView').innerHTML = `
    <div class="table-card-2025">
    <div class="table-header-2025">
        <h2 class="table-title-2025">Department Analytics</h2>
        <button id="downloadDEpttPDF" class="download-btn-2025">
        <i class="fas fa-download"></i>Downlaod PDF
        </button>
    </div>
    <div id="departmentsTableWrapper">
        <table class="table-2025">
        <thead>
            <tr>
            <th>Department</th>
            <th>Joined</th>
            <th>Left</th>
            <th>Active</th>
            <th>Exception</th>
            </tr>
        </thead>
        <tbody>${rows}${totalRow}</tbody>
        </table>
    </div>
    </div>
`;

  // pdf download listener
$('#downloadDEpttPDF')?.addEventListener('click', () => downloadDEpttPDF());
}

function downloadDEpttPDF() {
try {
    const element = document.getElementById('departmentsTableWrapper');
    const opt = {
    margin:       0.4,
    filename:    `Department_Details_${getCurrentDateString()}.pdf`,
    image:        { type: 'jpeg', quality: 1 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
} catch (error) {
    console.error('Error generating Vendor PDF:', error);
    alert('Failed to generate PDF. Please try again.');
}
}

// active view
function renderActiveView() {
const total = Object.values(lastResult).reduce((a, b) => a + b.active, 0);
  const rows = Object.keys(lastResult).map(k => {
    const v = lastResult[k], pct = total ? ((v.active/total)*100).toFixed(1) : '0.0';
    return `<tr>
    <td>${lastDisplay[k]}</td>
    <td>${v.active}</td>
    <td>${pct}%</td>
    </tr>`;
  }).join('');

  const totalRow = `<tr class="table-total-2025">
    <td>TOTAL</td>
    <td>${total}</td>
    <td>100.0%</td>
  </tr>`;

  $('#activeView').innerHTML = `
    <div class="table-card-2025">
      <div class="table-header-2025">
        <h2 class="table-title-2025">Active Team Analytics</h2>
        <button id="downloadActivePDF" class="download-btn-2025">
          <i class="fas fa-download"></i>Download PDF
        </button>
      </div>
      <div id="activeTableWrapper">
        <table class="table-2025">
          <thead><tr><th>Department</th><th>Active</th><th>Active %</th></tr></thead>
          <tbody>${rows}${totalRow}</tbody>
        </table>
      </div>
    </div>
  `;

  $('#downloadActivePDF')?.addEventListener('click', () => downloadActivePDF());
}


function downloadActivePDF() {
  try {
    const element = document.getElementById('activeTableWrapper');
    const opt = {
      margin: 0.4,
      filename: `Active_Details_${getCurrentDateString()}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 1 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}


// left table
function renderLeftView() {
  const total = Object.values(lastResult).reduce((a, b) => a + b.left, 0);
  
  const rows = Object.keys(lastResult).map(k => {
    const v = lastResult[k],
          pct = total ? ((v.left/total)*100).toFixed(1) : '0.0';
    return `<tr>
    <td>${lastDisplay[k]}</td>
    <td>${v.left}</td>
    <td>${pct}%</td>
    </tr>`;
  }).join('');

  const totalRow = `<tr class="table-total-2025">
    <td>TOTAL</td>
    <td>${total}</td>
    <td>100.0%</td>
  </tr>`;

  $('#leftView').innerHTML = `
    <div class="table-card-2025">
      <div class="table-header-2025">
        <h2 class="table-title-2025">Departures Analytics</h2>
        <button id="downloadLeftPDF" class="download-btn-2025">
          <i class="fas fa-download"></i>Download PDF
        </button>
      </div>
      <div id="leftTableWrapper">
        <table class="table-2025">
          <thead><tr><th>Department</th><th>Left</th><th>Left %</th></tr></thead>
          <tbody>${rows}${totalRow}</tbody>
        </table>
      </div>
    </div>
  `;


  $('#downloadLeftPDF')?.addEventListener('click', () => downloadLeftPDF());
}

function downloadLeftPDF() {
  try {
    const element = document.getElementById('leftTableWrapper');
    const opt = {
      margin:      0.4,
      filename:   `Left_Details_${getCurrentDateString()}.pdf`,
      image:       { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2 },
      jsPDF:       { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error generating Vendor PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}

// Vendor table
function renderVendorView() {
const stats = {};
const year = +$('#yearSelect').value, 
        month = +$('#monthSelect').value,
        week = +$('#weekSelect').value || 1;

let sDay, eDay, monthEnd;
if(reportType === 'monthly') {
    sDay = 1; eDay = daysInMonth(year, month);
    monthEnd = new Date(year, month, eDay);
} 
else if(reportType === 'weekly') {
    sDay = (week - 1) * 7 + 1; eDay = week === 4? daysInMonth(year, month) : sDay + 6;
    monthEnd = new Date(year, month, eDay);
}
else {
    sDay = selectedDay; eDay = selectedDay;
    monthEnd = new Date(year, month, selectedDay);
}

employeeData.forEach(emp => {
    const vend = (emp.VendorName || 'Unknown').trim();
    if(!stats[vend]) 
        stats[vend] = {active: 0, left: 0, joined: 0};
    const doj = parseDate(emp.DOJ), dol = parseDate(emp.DOL);
    if(doj && doj <= monthEnd && (!dol || dol > monthEnd)) 
        stats[vend].active++;
    if(isInRange(dol, year, month, sDay, eDay)) 
        stats[vend].left++;
    if(isInRange(doj, year, month, sDay, eDay))
        stats[vend].joined++;
});

let tA = 0, tL = 0, tJ = 0;
for(const v in stats) {
    tA += stats[v].active; 
    tL += stats[v].left; 
    tJ += stats[v].joined;
}

const rows = Object.keys(stats)
.sort((a,b) => a.localeCompare(b))
.map(v => {
    const s = stats[v];
    return `<tr>
    <td style="text-align:left;">${v}</td>
    <td>${s.active}</td>
    <td>${s.left}</td>
    <td>${s.joined}</td>
    </tr>`;
}).join('');

const totalRow = `<tr class="table-total-2025">
    <td style="text-align:center;">TOTAL</td>
    <td>${tA}</td>
    <td>${tL}</td>
    <td>${tJ}</td>
</tr>`;

$('#vendorView').innerHTML = `
    <div class="table-card-2025">
    <div class="table-header-2025" >
        <h2 class="table-title-2025">Vendor Analytics</h2>
        <button id="downloadVendorPDF" class="download-btn-2025">
        <i class="fas fa-download"></i>Download PDF
        </button>
    </div>
    <div id="vendorTableWrapper" >
        <table class="table-2025">
        <thead>
            <tr>
            <th style="text-align:left;">Vendor</th>
            <th>Active</th>
            <th>Left</th>
            <th>Joined</th>
            </tr>
        </thead>
        <tbody>${rows}${totalRow}</tbody>
        </table>
    </div>
    </div>
`;


$('#downloadVendorPDF')?.addEventListener('click', () => downloadVendorPDF());
}

function downloadVendorPDF() {
try {
    const element = document.getElementById('vendorTableWrapper');
    const opt = {
    margin:       0.4,
    filename:     `Vendor_Details_${getCurrentDateString()}.pdf`,
    image:         { type: 'jpeg', quality: 1 },
    html2canvas:   { scale: 2 },
    jsPDF:         { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('Error generating Vendor PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}

    // Stat Card Details
    function employeesByType(type) {
    const y = +$('#yearSelect').value, m = +$('#monthSelect').value, 
            w = reportType === 'weekly' ? selectedWeek : 1,
            d = reportType === 'daily' ? selectedDay : 1;
    
    let s, e, weekEnd;
    if(reportType === 'monthly') {
        s = 1; e = daysInMonth(y, m);
    }
    else if(reportType === 'weekly') {
        s = (w - 1) * 7 + 1; e = w === 4 ? daysInMonth(y, m) : s + 6;
    }
    else if(reportType === 'daily') {
        s = d; e = d;
    }
    
    weekEnd = new Date(y, m, e);
      
      return employeeData.filter(emp => {
        const doj = parseDate(emp.DOJ), dol = parseDate(emp.DOL);
        switch(type) {
          case 'active': return doj && doj <= weekEnd && (!dol || dol > weekEnd);
          case 'joined': return doj && isInRange(doj, y, m, s, e);
          case 'left': return dol && isInRange(dol, y, m, s, e);
          case 'exception': return doj && dol && doj > dol && isInRange(doj, y, m, s, e);
          default: return false;
        }
      });
    }

function showDetails(type, label) {
  const list = employeesByType(type);
  if(!list.length) { alert('No data available'); return; }
  const heads = Object.keys(list[0]);
  $('#detailsModalTitle').textContent = label;
  $('#detailsModalContent').innerHTML = `
    <div class="table-card-2025">
      <div class="table-header-2025" style="margin-bottom: 16px;">
        <p style="color: var(--text-secondary); margin: 0;">
          <strong>${list.length}</strong> employees found
        </p>
        <button id="downloadEmployeeExcel" class="download-btn-2025" style="background: var(--gradient-success);">
          <i class="fas fa-file-excel"></i>Download Excel
        </button>
      </div>
      <div style="max-height: 400px; overflow-y: auto;">
        <table class="table-2025">
          <thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${list.map(emp => `<tr>${heads.map(h => `<td>${emp[h] || ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
  

// Excel Download Function
function downloadEmployeeExcel(employeeList, reportTitle) {
  try {
    // Prepare data with headers
    const headers = Object.keys(employeeList[0] || {});
    const data = [headers, ...employeeList.map(emp => headers.map(h => emp[h] || ''))];
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Set column widths for better readability
    const columnWidths = headers.map(header => ({
      wch: Math.max(header.length, 15) // Minimum 15 characters width
    }));
    worksheet['!cols'] = columnWidths;
    
    // Style the header row
    const headerRange = XLSX.utils.decode_range(worksheet['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellRef]) continue;
      
      worksheet[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4A90E2" } },
        alignment: { horizontal: "center" }
      };
    }
    
    // Create workbook and add metadata
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: reportTitle,
      Subject: "Employee Analytics Report",
      Author: "BPLHQ Employee Dashboard",
      CreatedDate: new Date()
    };
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Details');
    
    // Generate filename with current date
    const currentDate = getCurrentDateString();
    const sanitizedTitle = reportTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedTitle}_${currentDate}.xlsx`;
    
    // Download the file
    XLSX.writeFile(workbook, filename);
    
    console.log(`Excel file downloaded: ${filename}`);
    
} catch (error) {
    console.error('Error generating Excel file:', error);
    alert('Failed to generate Excel file. Please try again.');
}
}
  // Add event listener for Excel download
$('#downloadEmployeeExcel')?.addEventListener('click', () => downloadEmployeeExcel(list, label));
  
$('#detailsModal').style.display = 'flex';
}

    // Search Functions
    function searchEmployees(q) {
      q = q.trim().toLowerCase();
      if(!q) { $('#searchResults').style.display = 'none'; return; }
      const found = employeeData.filter(emp =>
        (String(emp.Ecode||'') + ' ' + String(emp.Name||'') + ' ' + String(emp.Department||emp['Department Name']||''))
        .toLowerCase().includes(q)
      ).slice(0, 10);
$('#searchResults').innerHTML = found.length ?
        found.map(emp => `<div data-id="${emp.Ecode}">${emp.Ecode} – ${emp.Name}</div>`).join('') :
        '<div>No match found</div>';
$('#searchResults').style.display = 'block';
    }

    function showEmployee(emp) {
      const heads = Object.keys(emp);
      $('#detailsModalTitle').textContent = `Employee ${emp.Ecode}`;
      $('#detailsModalContent').innerHTML = `
        <div class="table-card-2025">
          <table class="table-2025">
            ${heads.map(h => `<tr>
                <th style="text-align:left;">${h}</th>
                <td>${emp[h] || ''}</td>
                </tr>`).join('')}
          </table>
        </div>
      `;
      $('#detailsModal').style.display = 'flex';
    }

    // View Switching
    function switchView(view, internal = false) {
      currentView = view;
      $('#dashboardView').style.display = view === 'dashboard' ? 'block' : 'none';
      $('#departmentsView').style.display = view === 'departments' ? 'block' : 'none';
      $('#activeView').style.display = view === 'active' ? 'block' : 'none';
      $('#leftView').style.display = view === 'left' ? 'block' : 'none';
      $('#vendorView').style.display = view === 'vendor' ? 'block' : 'none';
      
      $$('.nav-link-2025').forEach(b => b.classList.toggle('active', b.dataset.view === view));
      
      if(internal && view === 'dashboard') { renderDashboard(); return; }
      
      if(view === 'dashboard') renderDashboard();
      else if(view === 'departments') renderDepartments();
      else if(view === 'active') renderActiveView();
      else if(view === 'left') renderLeftView();
      else if(view === 'vendor') renderVendorView();
    }

    // Initialization
    const curYear = new Date().getFullYear();
    for(let y = curYear; y >= curYear - 15; y--)
        
    $('#yearSelect').insertAdjacentHTML('beforeend', `<option>${y}</option>`);
    $('#yearSelect').value = curYear; 
    $('#monthSelect').value = new Date().getMonth();

    // Event Listeners
    $('#yearSelect').addEventListener('change', () => {
    if(reportType === 'daily')
      populateDaySelect();
      generateReport();
    });
    $('#monthSelect').addEventListener('change', () => {
      if(reportType === 'daily') 
        populateDaySelect();
       generateReport();
    });

    $('#weeklyBtn').addEventListener('click', e => {
      reportType = 'weekly'; 
      $$('.pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      $('#weekSelect').style.display = 'inline-block';
      $('#dayLabel').style.display = 'none';
      generateReport();
    });

    $('#monthlyBtn').addEventListener('click', e => {
      reportType = 'monthly'; 
      $$('.pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      $('#weekSelect').style.display = 'none';
      $('#dayLabel').style.display = 'none';
      generateReport();
    });

    $('#dailyBtn').addEventListener('click', e => {
      reportType = 'daily'; 
      $$('.pill-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      $('#weekSelect').style.display = 'none';
      $('#dayLabel').style.display = 'inline-block';
      populateDaySelect();
      generateReport();
    });

    $('#weekSelect').addEventListener('change', e => {
      selectedWeek = +e.target.value;
      generateReport();
    });

    $('#daySelect').addEventListener('change', e => {
      selectedDay = +e.target.value;
      generateReport();
    });

    // Sidebar navigation
    $$('.nav-link-2025').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Stat cards
    $('#statCards').addEventListener('click', e => {
      const card = e.target.closest('.bento-card');
      if(!card) return;
      const type = card.dataset.type;
      if(type === 'activePercent' || type === 'leftPercent') {
        alert('Percentage card – no drill-down available');
        return;
      }
      showDetails(type, type.charAt(0).toUpperCase() + type.slice(1) + ' Employees');
    });

    // Modal close
    $('#closeDetailsModal').addEventListener('click', () => $('#detailsModal').style.display = 'none');
    $('#detailsModal').addEventListener('click', e => {
      if(e.target === e.currentTarget) $('#detailsModal').style.display = 'none';
    });

    // Search
    $('#searchInput').addEventListener('input', e => searchEmployees(e.target.value));
    $('#searchResults').addEventListener('click', e => {
      const div = e.target.closest('div[data-id]');
      if(!div) return;
      const emp = employeeData.find(emp => String(emp.Ecode) === div.dataset.id);
      if(emp) showEmployee(emp);
      $('#searchResults').style.display = 'none';
    });

    $('#searchBtn').addEventListener('click', () => {
      const v = $('#searchInput').value.trim().toLowerCase();
      if(!v) return;
      let emp = employeeData.find(emp => String(emp.Ecode || '').toLowerCase() === v);
      if(!emp) emp = employeeData.find(emp => String(emp.Name || '').toLowerCase() === v);
      emp ? showEmployee(emp) : alert('No employee found');
      $('#searchResults').style.display = 'none';
    });

// Theme toggle event listener - ADD THIS
$('#themeToggle').addEventListener('click', toggleTheme);

    document.addEventListener('click', e => {
      if(!e.target.closest('.search-float')) 
        $('#searchResults').style.display = 'none';
    });

    // Print
    $('#printBtn').addEventListener('click', () => window.print());

    // Initialize
 // Initialize (UPDATE YOUR EXISTING VERSION)
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme(); // Add this line
  fetchEmployeeData();
  $('#weekSelect').value = 1;
  $('#daySelect').value= currentDate;
  populateDaySelect();
});

// Theme Management
let currentTheme = 'dark';

// Initialize theme on page load
function initializeTheme() {
  const savedTheme = localStorage.getItem('bplhq-theme') || 'dark';
  setTheme(savedTheme);
}

// Set theme function
function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  
  // Update theme toggle button
  const themeIcon = $('#themeIcon');
  const themeText = $('#themeText');
  const themeToggle = $('#themeToggle');
  
  if (theme === 'light') {
    themeIcon.className = 'fas fa-sun nav-icon-2025';
    themeText.textContent = 'Light Mode';
    themeToggle.classList.add('active');
  } else {
    themeIcon.className = 'fas fa-moon nav-icon-2025';
    themeText.textContent = 'Dark Mode';
    themeToggle.classList.remove('active');
  }
  
  // Save theme preference
  localStorage.setItem('bplhq-theme', theme);
  
  // Update charts with new theme
  updateChartsTheme();
}



// Toggle between themes
function toggleTheme() {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// Update chart colors based on theme
function updateChartsTheme() {
  if (!window.dashboardCharts) return;
  
  const isLight = currentTheme === 'light';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  const textColor = isLight ? '#64748b' : '#a1a1aa';
  
  // Update existing charts
  window.dashboardCharts.forEach(chart => {
    if (chart && chart.options) {
      // Update grid colors
      if (chart.options.scales && chart.options.scales.y) {
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.y.ticks.color = textColor;
      }
      if (chart.options.scales && chart.options.scales.x) {
        chart.options.scales.x.grid.color = gridColor;
        chart.options.scales.x.ticks.color = textColor;
      }
      chart.update('none');
    }
  });
}

// Get theme-aware chart options
function getChartOptions() {
  const isLight = currentTheme === 'light';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  const textColor = isLight ? '#64748b' : '#a1a1aa';
  
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { 
      y: { 
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor }
      }
    }
  };
}

