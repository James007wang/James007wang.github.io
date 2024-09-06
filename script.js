document.addEventListener('DOMContentLoaded', () => {
    const generateMockDataBtn = document.getElementById('generateMockData');
    const generatePDFBtn = document.getElementById('generatePDF');
    const uploadForm = document.getElementById('uploadForm');
    const extractDataBtn = document.getElementById('extractData');
    const downloadPDFBtn = document.getElementById('downloadPDF');
    const resultDiv = document.getElementById('result');
    const mockDataDateInput = document.getElementById('mockDataDate');
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
        const selectedDate = new Date(mockDataDateInput.value);
        if (isNaN(selectedDate.getTime())) {
            alert('Please select a valid date');
            return;
        }
        mockData = generateMockData(selectedDate);
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
        const doctorName = document.getElementById('doctorName').value;

        if (selectedFiles.length === 0) {
            alert('Please select at least one PDF file');
            return;
        }

        try {
            resultDiv.innerHTML = '<p>Extracting data, please wait...</p>';
            extractedData = await extractScheduleFromMultipleFiles(selectedFiles, doctorName);
            console.log('Extracted data:', extractedData);  // Add this line
            if (extractedData.length > 0) {
                displayData(extractedData, 'Extracted Data:');
                downloadPDFBtn.disabled = false;
            } else {
                resultDiv.innerHTML = `
                    <p>No schedule found for ${doctorName}. Please check the following:</p>
                    <ul>
                        <li>The doctor's name is spelled correctly and matches exactly with the name in the PDF.</li>
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
        const doctorName = document.getElementById('doctorName').value;
        const filteredData = getFilteredData();
        console.log('Filtered data for PDF:', filteredData);
        if (filteredData.length === 0) {
            alert('No data to download after applying filters.');
            return;
        }
        const pdfDoc = generatePDF(filteredData);
        const now = new Date();
        const fileName = `${doctorName}-${now.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.pdf`;
        console.log('Download file name:', fileName);
        pdfDoc.save(fileName);
    });

    function updateFileList() {
        console.log('Number of files selected:', selectedFiles.length);
        console.log('Selected files:', selectedFiles);

        let fileListHTML = '<h4>Selected Files:</h4><ul>';
        for (let i = 0; i < selectedFiles.length; i++) {
            console.log(`File ${i + 1}:`, selectedFiles[i].name);
            fileListHTML += `<li>${selectedFiles[i].name}</li>`;
        }
        fileListHTML += '</ul>';
        fileListDiv.innerHTML = fileListHTML;
    }

    function displayData(data, title) {
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
        html += '<button id="applyFilter">Apply Filter</button>';
        html += '</div>';
        html += '<div id="dataTable"></div>';
        resultDiv.innerHTML = html;

        // Set default values for filter inputs
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('statusFilter').value = '';

        const applyFilterBtn = document.getElementById('applyFilter');
        applyFilterBtn.addEventListener('click', () => {
            updateDataTable(data);
        });

        updateDataTable(data);
    }

    function updateDataTable(data) {
        const filteredData = getFilteredData(data);
        const dataTableDiv = document.getElementById('dataTable');
        let totalPay = calculateTotalPay(filteredData);

        let tableHtml = '<table><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Patient</th><th>Service</th><th>Duration</th><th>Pay</th><th>Status</th></tr>';
        filteredData.forEach(appointment => {
            tableHtml += `<tr>
                <td>${appointment.date}</td>
                <td>${appointment.time}</td>
                <td>${appointment.doctor}</td>
                <td>${appointment.patient}</td>
                <td>${appointment.service}</td>
                <td>${appointment.duration}</td>
                <td>${appointment.pay}</td>
                <td>${appointment.status}</td>
            </tr>`;
        });
        tableHtml += '</table>';
        tableHtml += `<p>Total Pay: $${totalPay.toFixed(2)}</p>`;
        dataTableDiv.innerHTML = tableHtml;
    }

    function getFilteredData() {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const statusFilterSelect = document.getElementById('statusFilter');
        return filterData(
            extractedData, 
            startDateInput ? startDateInput.value : '', 
            endDateInput ? endDateInput.value : '', 
            statusFilterSelect ? statusFilterSelect.value : ''
        );
    }

    function filterData(data, startDate, endDate, status) {
        console.log('Filtering data:', { data, startDate, endDate, status });
        if (!data || !Array.isArray(data)) {
            console.error('Invalid data for filtering:', data);
            return [];
        }
        return data.filter(appointment => {
            if (startDate && startDate !== '') {
                const appointmentDate = new Date(appointment.date);
                if (appointmentDate < new Date(startDate)) return false;
            }
            if (endDate && endDate !== '') {
                const appointmentDate = new Date(appointment.date);
                if (appointmentDate > new Date(endDate)) return false;
            }
            if (status && status !== '') {
                if (appointment.status !== status) return false;
            }
            return true;
        });
    }

    function calculateTotalPay(data) {
        return data.reduce((total, appointment) => {
            const pay = parseFloat(appointment.pay.replace('$', ''));
            return total + (isNaN(pay) ? 0 : pay);
        }, 0);
    }

    async function extractScheduleFromMultipleFiles(files, doctorName) {
        let allSchedules = [];

        for (let file of files) {
            try {
                const schedule = await extractSchedule(file, doctorName);
                allSchedules = allSchedules.concat(schedule);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
            }
        }

        return allSchedules;
    }

    async function extractSchedule(file, doctorName) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const schedule = [];
        let totalText = '';

        //const regexPattern = `(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4})\\s*[,.]?\\s*(\\d{1,2}:\\d{2})\\s*[,.]?\\s*(${doctorName})\\s*[,.]?\\s*(Patient\\s*\\d+)\\s*[,.]?\\s*([\\w\\s]+)\\s*[,.]?\\s*(\\d+\\s*min)\\s*[,.]?\\s*(\\$\\d+)\\s*[,.]?\\s*(\\w+)`;
        const regexPattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}\s*[APM]{2})\s+(Dr\.\s*[A-Za-z]+)\s+(Patient\s*\d+)\s+([A-Za-z]+)\s+(\d+min)\s+\$?(\d+)\s+(Confirmed|Pending|Cancelled)/;
        const regex = new RegExp(regexPattern, 'gi');

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            totalText += pageText + ' ';

            console.log(`Page ${i} content:`, pageText);  // Debugging: Log each page's content

            let match;
            while ((match = regex.exec(pageText)) !== null) {
                if(match[3]===doctorName){
                    schedule.push({
                    date: match[1],
                    time: match[2],
                    doctor: match[3],
                    patient: match[4],
                    service: match[5].trim(),
                    duration: match[6],
                    pay: match[7],
                    status: match[8]
                });
                console.log('Matched:', match[0]);
                }
                  // Debugging: Log each matched record
            }
        }

        console.log('Total text content:', totalText);  // Debugging: Log all text content
        console.log('Extracted schedule:', schedule);  // Debugging: Log the final extracted schedule

        if (schedule.length === 0) {
            console.log(`No matches found for doctor: ${doctorName}`);
            console.log('Regex used:', regexPattern);
            
            // Additional debugging: search for the doctor's name in the text
            const doctorNameIndex = totalText.indexOf(doctorName);
            if (doctorNameIndex !== -1) {
                console.log(`Doctor name found at index ${doctorNameIndex}`);
                console.log('Surrounding text:', totalText.substring(Math.max(0, doctorNameIndex - 50), doctorNameIndex + 50));
            } else {
                console.log(`Doctor name "${doctorName}" not found in the text`);
            }
        }

        return schedule;
    }

    function generatePDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.text('Filtered Schedule', 14, 15);

        const columns = ['Date', 'Time', 'Doctor', 'Patient', 'Service', 'Duration', 'Pay', 'Status'];
        const rows = data.map(appointment => [
            appointment.date,
            appointment.time,
            appointment.doctor,
            appointment.patient,
            appointment.service,
            appointment.duration,
            appointment.pay,
            appointment.status
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

    // ... (rest of the functions remain the same)
});
