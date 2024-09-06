document.addEventListener('DOMContentLoaded', () => {
    const generateMockDataBtn = document.getElementById('generateMockData');
    const generatePDFBtn = document.getElementById('generatePDF');
    const uploadForm = document.getElementById('uploadForm');
    const extractDataBtn = document.getElementById('extractData');
    const downloadPDFBtn = document.getElementById('downloadPDF');
    const resultDiv = document.getElementById('result');
    const mockDataStartDateInput = document.getElementById('mockDataStartDate');
    const mockDataEndDateInput = document.getElementById('mockDataEndDate');
    const pdfFileInput = document.getElementById('pdfFile');
    const fileListDiv = document.getElementById('fileList');

    let mockData = [];
    let extractedData = [];
    let selectedFiles = []; // Array to store selected files

    if (!pdfFileInput) {
        console.error('PDF file input element not found');
        return;
    }

    if (!fileListDiv) {
        console.error('File list div not found');
        return;
    }

    generateMockDataBtn.addEventListener('click', () => {
        const startDate = new Date(mockDataStartDateInput.value);
        const endDate = new Date(mockDataEndDateInput.value);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            alert('Please select valid start and end dates');
            return;
        }
        
        if (startDate > endDate) {
            alert('Start date must be before end date');
            return;
        }
        
        mockData = generateMockData(startDate, endDate);
        console.log('Mock data:', mockData);
        displayData(mockData, 'Mock Data Generated:');
        generatePDFBtn.disabled = false;
    });

    generatePDFBtn.addEventListener('click', () => {
        const pdfDoc = generatePDF(mockData);
        const now = new Date();
        const fileName = now.toISOString().replace(/[:T]/g, '-').slice(0, -5) + '.pdf'; // Format: YYYY-MM-DD-HH-MM-SS.pdf
        pdfDoc.save(fileName);
        alert(`Mock PDF generated and downloaded as ${fileName}`);
    });

    pdfFileInput.addEventListener('change', (event) => {
        const newFiles = Array.from(event.target.files);
        selectedFiles = [...selectedFiles, ...newFiles];
        updateFileList();
    });

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedFiles.length === 0) {
            alert('Please select at least one PDF file');
            return;
        }

        try {
            resultDiv.innerHTML = '<p>Extracting data, please wait...</p>';
            extractedData = await extractScheduleFromMultipleFiles(selectedFiles);
            console.log('Extracted data:', extractedData);
            if (extractedData.length > 0) {
                displayData(extractedData, 'Extracted Data:');
                downloadPDFBtn.disabled = false;
            } else {
                resultDiv.innerHTML = `
                    <p>No schedule found in the selected PDFs. Please check the following:</p>
                    <ul>
                        <li>The PDF content is in the expected format.</li>
                        <li>The PDF is not password-protected or encrypted.</li>
                    </ul>
                    <p>Check the browser console (F12) for more detailed debugging information.</p>
                `;
            }
        } catch (error) {
            console.error('Error:', error);
            resultDiv.innerHTML = `<p>An error occurred while processing the PDFs: ${error.message}</p>`;
        }
    });

    downloadPDFBtn.addEventListener('click', () => {
        if (!extractedData || !Array.isArray(extractedData) || extractedData.length === 0) {
            console.error('No valid data to filter:', extractedData);
            alert('No data available to download. Please extract or generate data first.');
            return;
        }
        const filteredData = getFilteredData(extractedData);
        console.log('Filtered data for PDF:', filteredData);
        if (filteredData.length === 0) {
            alert('No data to download after applying filters.');
            return;
        }
        const pdfDoc = generatePDF(filteredData);
        const now = new Date();
        const fileName = `schedule-${now.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.pdf`;
        console.log('Download file name:', fileName);
        pdfDoc.save(fileName);
    });

    function updateFileList() {
        console.log('Number of files selected:', selectedFiles.length);
        console.log('Selected files:', selectedFiles);

        let fileListHTML = '<h4>Selected Files:</h4><ul class="file-list">';
        for (let i = 0; i < selectedFiles.length; i++) {
            console.log(`File ${i + 1}:`, selectedFiles[i].name);
            fileListHTML += `<li>
                <span class="file-name">${selectedFiles[i].name}</span>
                <button class="removeFile" data-index="${i}" title="Remove file">×</button>
            </li>`;
        }
        fileListHTML += '</ul>';
        fileListDiv.innerHTML = fileListHTML;

        // Add event listeners to remove buttons
        const removeButtons = document.querySelectorAll('.removeFile');
        removeButtons.forEach(button => {
            button.addEventListener('click', removeFile);
        });
    }

    function removeFile(event) {
        const index = parseInt(event.target.getAttribute('data-index'));
        selectedFiles.splice(index, 1);
        updateFileList();
    }

    function displayData(data, title) {
        console.log('Displaying data:', data); // Debug log

        let html = `<h3>${title}</h3>`;
        html += '<div id="filterControls">';
        html += '<label for="startDate">Start Date: </label><input type="date" id="startDate">';
        html += '<label for="endDate">End Date: </label><input type="date" id="endDate">';
        html += '<label for="statusFilter">Status: </label><select id="statusFilter">';
        html += '<option value="">All</option>';
        html += '<option value="Confirmed">Confirmed</option>';
        html += '<option value="Pending">Pending</option>';
        html += '<option value="Cancelled">Cancelled</option>';
        html += '</select>';
        html += '<label for="doctorFilter">Doctor: </label><select id="doctorFilter">';
        html += '<option value="">All</option>';
        // Add doctor options dynamically
        [...new Set(data.map(item => item.Doctor))].forEach(doctor => {
            html += `<option value="${doctor}">${doctor}</option>`;
        });
        html += '</select>';
        html += '<button id="applyFilter">Apply Filter</button>';
        html += '</div>';
        html += '<div id="dataTable"></div>';
        resultDiv.innerHTML = html;

        // Set default values for filter inputs
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('doctorFilter').value = '';

        const applyFilterBtn = document.getElementById('applyFilter');
        applyFilterBtn.addEventListener('click', () => {
            updateDataTable(data);
        });

        updateDataTable(data, false); // Pass false to indicate it's the initial display
    }

    function updateDataTable(data, applyFilter = true) {
        const filteredData = applyFilter ? getFilteredData(data) : data;
        console.log('Filtered data:', filteredData); // Debug log
        const dataTableDiv = document.getElementById('dataTable');
        let totalPay = calculateTotalPay(filteredData);

        let tableHtml = '<table><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Patient</th><th>Service</th><th>Duration</th><th>Pay</th><th>Status</th></tr>';
        filteredData.forEach(appointment => {
            tableHtml += `<tr>
                <td>${appointment.Date}</td>
                <td>${appointment.Time}</td>
                <td>${appointment.Doctor}</td>
                <td>${appointment.Patient}</td>
                <td>${appointment.Service}</td>
                <td>${appointment.Duration}</td>
                <td>${appointment.Pay}</td>
                <td>${appointment.Status}</td>
            </tr>`;
        });
        tableHtml += '</table>';
        tableHtml += `<p>Total Pay: $${totalPay.toFixed(2)}</p>`;
        dataTableDiv.innerHTML = tableHtml;
    }

    function getFilteredData(data) {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const statusFilterSelect = document.getElementById('statusFilter');
        const doctorFilterSelect = document.getElementById('doctorFilter');
        return filterData(
            data, 
            startDateInput ? startDateInput.value : '', 
            endDateInput ? endDateInput.value : '', 
            statusFilterSelect ? statusFilterSelect.value : '',
            doctorFilterSelect ? doctorFilterSelect.value : ''
        );
    }

    function filterData(data, startDate, endDate, status, doctor) {
        return data.filter(appointment => {
            const appointmentDate = new Date(appointment.Date);
            if (startDate && startDate !== '' && appointmentDate < new Date(startDate)) return false;
            if (endDate && endDate !== '' && appointmentDate > new Date(endDate)) return false;
            if (status && status !== '' && appointment.Status !== status) return false;
            if (doctor && doctor !== '' && appointment.Doctor !== doctor) return false;
            return true;
        });
    }

    function calculateTotalPay(data) {
        return data.reduce((total, appointment) => {
            const pay = parseFloat(appointment.Pay.replace('$', ''));
            return total + (isNaN(pay) ? 0 : pay);
        }, 0);
    }

    async function extractScheduleFromMultipleFiles(files) {
        let allSchedules = [];

        for (let file of files) {
            try {
                const schedule = await extractSchedule(file);
                allSchedules = allSchedules.concat(schedule);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
            }
        }

        return allSchedules;
    }

    async function extractSchedule(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const schedule = [];
        let totalText = '';

        const regexPattern = /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(Dr\.\s+[A-Za-z]+)\s+(Patient\s+\d+)\s+([A-Za-z]+)\s+(\d+\s+min)\s+(\$\d+)\s+(\w+)/g;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            totalText += pageText + ' ';

            console.log(`Page ${i} content:`, pageText);  // Debugging: Log each page's content

            let match;
            while ((match = regexPattern.exec(pageText)) !== null) {
                schedule.push({
                    Date: match[1],
                    Time: match[2],
                    Doctor: match[3],
                    Patient: match[4],
                    Service: match[5],
                    Duration: match[6],
                    Pay: match[7],
                    Status: match[8]
                });
                console.log('Matched:', match[0]);
            }
        }

        console.log('Total text content:', totalText);  // Debugging: Log all text content
        console.log('Extracted schedule:', schedule);  // Debugging: Log the final extracted schedule

        return schedule;
    }

    function generatePDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.text('Filtered Schedule', 14, 15);

        const columns = ['Date', 'Time', 'Doctor', 'Patient', 'Service', 'Duration', 'Pay', 'Status'];
        const rows = data.map(appointment => [
            appointment.Date,
            appointment.Time,
            appointment.Doctor,
            appointment.Patient,
            appointment.Service,
            appointment.Duration,
            appointment.Pay,
            appointment.Status
        ]);

        doc.autoTable({
            head: [columns],
            body: rows,
            startY: 20,
            styles: { cellPadding: 1.5, fontSize: 10 },
            columnStyles: { 0: { cellWidth: 23 } }
        });

        const totalPay = calculateTotalPay(data);
        doc.text(`Total Pay: $${totalPay.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 10);

        return doc;
    }

    function generateMockData(startDate, endDate) {
        const mockData = [];
        const statuses = ['Confirmed', 'Pending', 'Cancelled'];
        const services = ['Check-up', 'Vaccination', 'Surgery', 'Consultation'];
        const doctors = ['Dr. Smith', 'Dr. Johnson', 'Dr. Williams', 'Dr. Brown', 'Dr. Jones'];

        const start = new Date(startDate);
        const end = new Date(endDate);
        const dayRange = (end - start) / (1000 * 60 * 60 * 24);

        doctors.forEach(doctor => {
            for (let i = 0; i < 10; i++) {
                const appointmentDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
                mockData.push({
                    Date: appointmentDate.toISOString().split('T')[0],
                    Time: `${String(Math.floor(Math.random() * 12 + 8)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
                    Doctor: doctor,
                    Patient: `Patient ${i + 1}`,
                    Service: services[Math.floor(Math.random() * services.length)],
                    Duration: `${Math.floor(Math.random() * 30 + 15)} min`,
                    Pay: `$${Math.floor(Math.random() * 200 + 50)}`,
                    Status: statuses[Math.floor(Math.random() * statuses.length)]
                });
            }
        });

        console.log('Generated mock data:', mockData);
        return mockData;
    }
});
