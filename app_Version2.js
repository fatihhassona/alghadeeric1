<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام إدارة مهام التسويق</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    
    <!-- Firebase SDKs -->
    <script type="module">
        const firebaseConfig = typeof __firebase_config !== 'undefined' 
            ? JSON.parse(__firebase_config)
            : {
                apiKey: "YOUR_API_KEY", authDomain: "YOUR_AUTH_DOMAIN", projectId: "YOUR_PROJECT_ID",
                storageBucket: "YOUR_STORAGE_BUCKET", messagingSenderId: "YOUR_MESSAGING_SENDER_ID", appId: "YOUR_APP_ID"
            };
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
        import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        window.firebase = { db, doc, getDoc, setDoc };
    </script>

    <style>
        body { font-family: 'Cairo', sans-serif; background-color: #111827; }
        .view { display: none; }
        .view.active { display: block; }
        .status-not-started { background-color: #4b5563; }
        .status-in-progress { background-color: #2563eb; }
        .status-completed { background-color: #16a34a; }
        .dept-card:hover { transform: translateY(-10px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        .status-filter-btn.active {
            background-color: #3b82f6;
            color: white;
            font-weight: bold;
        }
    </style>
</head>
<body class="text-white">

    <div id="loading-spinner" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 hidden">
        <div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>

    <!-- Main App View -->
    <div id="main-app-view" class="active">
        <div class="container mx-auto p-4 md:p-8">
            <header class="text-center mb-6">
                 <div class="flex justify-center items-center">
                    <h1 class="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">لوحة المهام</h1>
                </div>
                <div class="flex justify-center items-center gap-4 mt-4">
                    <label for="date-picker" class="text-lg text-gray-400">عرض مهام يوم:</label>
                    <input type="date" id="date-picker" class="bg-gray-700 text-white rounded-lg p-2 border-2 border-gray-600 focus:outline-none focus:border-blue-500">
                </div>
                <p id="readonly-notice" class="text-yellow-400 mt-2 h-6"></p>
            </header>
            
            <div id="home-view" class="view"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8"></div><div class="flex flex-col sm:flex-row justify-center items-center gap-4"><button onclick="window.exportToExcel()" class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2">تصدير مهام اليوم المحدد</button></div></div>
            <div id="department-view" class="view"></div>
            <div id="reports-view" class="view"></div>
        </div>
    </div>

    <script type="module">
        // State Variables
        let tasksData = {};
        let selectedDate;
        let statusFilters = {}; // To hold filter state for each department
        const { db, doc, getDoc, setDoc } = window.firebase;

        // DOM Elements
        const datePicker = document.getElementById('date-picker');
        const loadingSpinner = document.getElementById('loading-spinner');

        // --- INITIALIZATION ---
        document.addEventListener('DOMContentLoaded', () => {
            initializeApp();
        });

        function initializeApp() {
            const today = new Date().toISOString().slice(0, 10);
            datePicker.value = today;
            selectedDate = today;
            datePicker.addEventListener('change', (e) => {
                selectedDate = e.target.value;
                loadTasksForDate(selectedDate);
            });
            loadTasksForDate(today);
            showView('home-view');
        }
        
        // --- DATA MANAGEMENT, VIEW NAVIGATION, PERMISSIONS, UI RENDERING ---
        const departments = { 'dept-primo': { name: 'قسم إلبريمو', color: 'purple', icon: `<svg class="h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>` }, 'dept-joyce': { name: 'قسم جويس', color: 'green', icon: `<svg class="h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>` }, 'dept-ikhtiyar': { name: 'قسم الاختيار الأول', color: 'blue', icon: `<svg class="h-12 w-12" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>` }};
        const initialTasks = { 'dept-primo': [], 'dept-joyce': [], 'dept-ikhtiyar': [] };

        async function loadTasksForDate(dateString) {
            loadingSpinner.classList.remove('hidden');
            try {
                const docRef = doc(db, "tasks", dateString);
                const docSnap = await getDoc(docRef);
                tasksData = docSnap.exists() ? docSnap.data() : JSON.parse(JSON.stringify(initialTasks));
            } catch (error) {
                console.error("Firebase read error:", error);
                tasksData = JSON.parse(JSON.stringify(initialTasks));
                document.getElementById('readonly-notice').textContent = "لا يمكن تحميل البيانات. قد تكون هناك مشكلة في الاتصال.";
            }
            
            const currentViewId = document.querySelector('#main-app-view .view.active')?.id || 'home-view';
            showView(currentViewId, document.body.dataset.currentDept || null);
            loadingSpinner.classList.add('hidden');
        }

        async function saveTasks() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selected = new Date(selectedDate);
            selected.setHours(0,0,0,0);

            if (selected < today) return; // Prevent saving for past dates
            try {
                const docRef = doc(db, "tasks", selectedDate);
                await setDoc(docRef, tasksData);
            } catch(error) {
                console.error("Firebase write error:", error);
                alert("حدث خطأ أثناء حفظ المهام.");
            }
        }

        function showView(viewId, deptId = null) {
            document.querySelectorAll('#main-app-view .view').forEach(v => v.classList.remove('active'));
            const view = document.getElementById(viewId);
            if(view) view.classList.add('active');
            
            if (viewId === 'department-view' && deptId) { document.body.dataset.currentDept = deptId; renderDepartmentView(deptId); }
            else if (viewId === 'home-view') { document.body.dataset.currentDept = ''; generateHomeCards(); }
            else if (viewId === 'reports-view') { document.body.dataset.currentDept = ''; renderReportsView(); }
            
            toggleReadOnlyMode();
        }

        function toggleReadOnlyMode() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selected = new Date(selectedDate);
            selected.setHours(0,0,0,0);
            const isReadOnlyForDate = selected < today;

            document.querySelectorAll('.task-input, .status-select').forEach(el => el.disabled = isReadOnlyForDate);
            document.querySelectorAll('.delete-btn, #add-task-btn').forEach(el => el.style.display = isReadOnlyForDate ? 'none' : '');
            
            let notice = '';
            if (isReadOnlyForDate) {
                notice = 'أنت في وضع القراءة فقط لسجل سابق.';
            }
            document.getElementById('readonly-notice').textContent = notice;
        }

        function generateHomeCards() {
            let container = document.querySelector('#home-view .grid');
            if (!container) return;
            container.innerHTML = '';
            
            let reportCard = document.createElement('div');
            reportCard.className = `dept-card bg-gray-800 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer border-b-4 border-yellow-500`;
            reportCard.onclick = () => showView('reports-view');
            reportCard.innerHTML = `<div class="text-yellow-400 mb-4"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><h2 class="text-2xl font-bold mb-2">التقارير</h2><p class="text-gray-400">تصدير تقارير مخصصة</p>`;
            container.appendChild(reportCard);

            for (const deptId in departments) {
                const dept = departments[deptId];
                let card = document.createElement('div');
                card.className = `dept-card bg-gray-800 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer border-b-4 border-${dept.color}-500`;
                card.onclick = () => showView('department-view', deptId);
                card.innerHTML = `<div class="text-${dept.color}-400 mb-4">${dept.icon}</div><h2 class="text-2xl font-bold mb-2">${dept.name}</h2><p class="text-gray-400">انقر لعرض وإدارة المهام</p>`;
                container.appendChild(card);
            }
        }

        function renderDepartmentView(deptId) {
            const dept = departments[deptId];
            const container = document.getElementById('department-view');
            container.innerHTML = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-${dept.color}-400 to-${dept.color}-600">${dept.name}</h2>
                    <button onclick="window.showView('home-view')" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition">→ العودة للرئيسية</button>
                </div>
                <div class="bg-gray-800 rounded-2xl shadow-lg p-6">
                    <div class="flex items-center justify-center gap-2 mb-6 p-2 bg-gray-700/50 rounded-lg" id="status-filter-controls-${deptId}">
                        <button data-status="all" class="status-filter-btn px-4 py-2 text-sm rounded-md transition">الكل</button>
                        <button data-status="not-started" class="status-filter-btn px-4 py-2 text-sm rounded-md transition">لم تبدأ</button>
                        <button data-status="in-progress" class="status-filter-btn px-4 py-2 text-sm rounded-md transition">قيد التنفيذ</button>
                        <button data-status="completed" class="status-filter-btn px-4 py-2 text-sm rounded-md transition">مكتملة</button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left">
                           <thead class="text-xs text-gray-300 uppercase"><tr><th class="px-2 py-3">المهمة</th><th class="px-2 py-3">الوقت</th><th class="px-2 py-3">ملاحظات</th><th class="px-2 py-3">الحالة</th><th class="px-2 py-3"></th></tr></thead>
                            <tbody id="task-list-${deptId}" class="divide-y divide-gray-700"></tbody>
                        </table>
                    </div>
                    <button id="add-task-btn" onclick="window.addTask('${deptId}')" class="mt-6 bg-gradient-to-r from-${dept.color}-500 to-${dept.color}-600 hover:opacity-90 text-white font-bold py-2 px-4 rounded-lg transition w-full">+ إضافة مهمة</button>
                </div>`;
            
            const filterContainer = document.getElementById(`status-filter-controls-${deptId}`);
            filterContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('status-filter-btn')) {
                    const status = e.target.dataset.status;
                    statusFilters[deptId] = status;
                    filterContainer.querySelectorAll('.status-filter-btn').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    renderTaskRows(deptId);
                }
            });

            const currentFilter = statusFilters[deptId] || 'all';
            filterContainer.querySelector(`[data-status="${currentFilter}"]`).classList.add('active');

            renderTaskRows(deptId);
        }

        function renderTaskRows(deptId) {
            const tbody = document.getElementById(`task-list-${deptId}`);
            if (!tbody) return;
            tbody.innerHTML = '';
            if (!tasksData[deptId]) tasksData[deptId] = [];

            const currentFilter = statusFilters[deptId] || 'all';
            const filteredTasks = tasksData[deptId].filter(task => currentFilter === 'all' || task.status === currentFilter);

            if (filteredTasks.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">لا توجد مهام تطابق هذا الفلتر.</td></tr>`;
            } else {
                filteredTasks.forEach(task => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-700/50';
                    tr.dataset.id = task.id;
                    tr.innerHTML = `
                        <td class="px-2 py-3"><input type="text" value="${task.task}" oninput="window.updateTaskField(${task.id}, '${deptId}', 'task', this.value)" placeholder="أدخل المهمة..." class="task-input w-full bg-transparent focus:bg-gray-700 rounded px-1 py-1 border-none focus:outline-none focus:ring-1 ring-blue-500"></td>
                        <td class="px-2 py-3"><input type="text" value="${task.time}" oninput="window.updateTaskField(${task.id}, '${deptId}', 'time', this.value)" placeholder="الوقت..." class="task-input w-24 bg-transparent focus:bg-gray-700 rounded px-1 py-1 border-none focus:outline-none focus:ring-1 ring-yellow-500"></td>
                        <td class="px-2 py-3"><input type="text" value="${task.notes}" oninput="window.updateTaskField(${task.id}, '${deptId}', 'notes', this.value)" placeholder="ملاحظات..." class="task-input w-full bg-transparent focus:bg-gray-700 rounded px-1 py-1 border-none focus:outline-none focus:ring-1 ring-gray-500"></td>
                        <td class="px-2 py-3">
                            <select onchange="window.updateTaskField(${task.id}, '${deptId}', 'status', this.value); window.updateStatusColor(this);" class="status-select w-full text-white font-semibold p-2 rounded-md border-none focus:outline-none focus:ring-2 ring-offset-2 ring-offset-gray-800 ring-purple-500">
                                <option value="not-started" class="bg-gray-700" ${task.status === 'not-started' ? 'selected' : ''}>لم يبدأ</option>
                                <option value="in-progress" class="bg-gray-700" ${task.status === 'in-progress' ? 'selected' : ''}>قيد التنفيذ</option>
                                <option value="completed" class="bg-gray-700" ${task.status === 'completed' ? 'selected' : ''}>مكتمل</option>
                            </select>
                        </td>
                        <td class="px-2 py-3 text-center">
                            <button class="delete-btn text-gray-500 hover:text-red-500 transition"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </td>`;
                    tr.querySelector('.delete-btn').onclick = () => window.deleteTask(task.id, deptId);
                    tbody.appendChild(tr);
                    window.updateStatusColor(tr.querySelector('.status-select'));
                });
            }
        }
        
        function renderReportsView() {
            const container = document.getElementById('reports-view');
            let content = `
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold">تقارير مخصصة</h2>
                    <button onclick="window.showView('home-view')" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition">→ العودة للرئيسية</button>
                </div>
                <div class="bg-gray-800 p-6 rounded-2xl">
                    <h3 class="text-xl font-bold mb-4 border-b-2 border-yellow-500 pb-2">تصدير تقرير حسب نطاق زمني</h3>
                    <p class="text-gray-400 mb-6">اختر نطاق التاريخ المطلوب لتصدير تقرير شامل لجميع المهام في ملف Excel.</p>
                    <div class="flex flex-col sm:flex-row gap-4 items-center justify-center mb-4">
                        <div class="flex items-center gap-2">
                            <label for="report-date-from" class="text-gray-300">من تاريخ:</label>
                            <input type="date" id="report-date-from" class="bg-gray-700 text-white rounded-lg p-2 border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                        <div class="flex items-center gap-2">
                            <label for="report-date-to" class="text-gray-300">إلى تاريخ:</label>
                            <input type="date" id="report-date-to" class="bg-gray-700 text-white rounded-lg p-2 border-gray-600 focus:outline-none focus:border-blue-500">
                        </div>
                    </div>
                     <div class="flex items-center justify-center gap-2 mb-6 p-2 bg-gray-700/50 rounded-lg">
                        <button onclick="window.setReportRange('week')" class="px-4 py-2 text-sm rounded-md transition hover:bg-gray-600">هذا الأسبوع</button>
                        <button onclick="window.setReportRange('month')" class="px-4 py-2 text-sm rounded-md transition hover:bg-gray-600">هذا الشهر</button>
                    </div>
                    <div class="text-center">
                        <button onclick="window.exportDateRangeReport()" class="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-5 rounded-lg transition flex items-center gap-2 mx-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            تصدير التقرير
                        </button>
                    </div>
                </div>
            `;
            container.innerHTML = content;
            
            // Set default dates
            document.getElementById('report-date-to').value = new Date().toISOString().slice(0, 10);
            let oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            document.getElementById('report-date-from').value = oneWeekAgo.toISOString().slice(0, 10);
        }

        // --- Make functions globally accessible ---
        window.showView = showView;
        window.updateStatusColor = (select) => { select.classList.remove('status-not-started', 'status-in-progress', 'status-completed'); select.classList.add(`status-${select.value.replace('_','-')}`); };
        window.updateTaskField = (taskId, deptId, field, value) => { const task = tasksData[deptId]?.find(t => t.id === taskId); if (task) { task[field] = value; saveTasks(); } };
        window.deleteTask = (taskId, deptId) => { tasksData[deptId] = tasksData[deptId].filter(t => t.id !== taskId); saveTasks(); renderTaskRows(deptId); };
        window.addTask = (deptId) => { const newId = Date.now(); const newTask = { id: newId, task: '', status: 'not-started', time: '', notes: '' }; if (!tasksData[deptId]) tasksData[deptId] = []; tasksData[deptId].push(newTask); saveTasks(); renderTaskRows(deptId); };
        
        window.exportToExcel = () => {
             const wb = XLSX.utils.book_new();
            for (const deptId in tasksData) {
                const deptName = departments[deptId].name;
                if (tasksData[deptId] && tasksData[deptId].length > 0) {
                    const dataToExport = tasksData[deptId].map(t => ({'المهمة': t.task, 'الحالة': t.status, 'الوقت': t.time, 'ملاحظات': t.notes}));
                    const ws = XLSX.utils.json_to_sheet(dataToExport);
                    XLSX.utils.book_append_sheet(wb, ws, deptName);
                }
            }
            XLSX.writeFile(wb, `Marketing_Tasks_${selectedDate}.xlsx`);
        };

        window.setReportRange = (range) => {
            const fromInput = document.getElementById('report-date-from');
            const toInput = document.getElementById('report-date-to');
            const today = new Date();
            toInput.value = today.toISOString().slice(0, 10);

            if (range === 'week') {
                const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))); // Assuming Monday is start of week
                fromInput.value = startOfWeek.toISOString().slice(0, 10);
            } else if (range === 'month') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                fromInput.value = startOfMonth.toISOString().slice(0, 10);
            }
        };

        window.exportDateRangeReport = async () => {
            loadingSpinner.classList.remove('hidden');
            const startDateString = document.getElementById('report-date-from').value;
            const endDateString = document.getElementById('report-date-to').value;

            if (!startDateString || !endDateString || new Date(startDateString) > new Date(endDateString)) {
                alert("الرجاء تحديد نطاق تاريخ صحيح.");
                loadingSpinner.classList.add('hidden');
                return;
            }

            const aggregatedTasks = { 'dept-primo': [], 'dept-joyce': [], 'dept-ikhtiyar': [] };
            
            let currentDate = new Date(startDateString);
            const endDate = new Date(endDateString);
            
            const promises = [];
            const dates = [];

            while (currentDate <= endDate) {
                const dateString = currentDate.toISOString().slice(0, 10);
                dates.push(dateString);
                const docRef = doc(db, "tasks", dateString);
                promises.push(getDoc(docRef));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            try {
                const docSnaps = await Promise.all(promises);
                
                docSnaps.forEach((docSnap, index) => {
                    const dateString = dates[index];
                    if (docSnap.exists()) {
                        const dailyTasks = docSnap.data();
                        for (const deptId in dailyTasks) {
                            if (aggregatedTasks[deptId] && Array.isArray(dailyTasks[deptId])) {
                                dailyTasks[deptId].forEach(task => {
                                    aggregatedTasks[deptId].push({ date: dateString, ...task });
                                });
                            }
                        }
                    }
                });

                const wb = XLSX.utils.book_new();
                for (const deptId in aggregatedTasks) {
                    const deptName = departments[deptId].name;
                    if (aggregatedTasks[deptId].length > 0) {
                        const dataToExport = aggregatedTasks[deptId].map(t => ({
                            'التاريخ': t.date,
                            'المهمة': t.task,
                            'الحالة': t.status,
                            'الوقت': t.time,
                            'ملاحظات': t.notes
                        }));
                        const ws = XLSX.utils.json_to_sheet(dataToExport);
                        XLSX.utils.book_append_sheet(wb, ws, deptName);
                    }
                }
                
                if (wb.SheetNames.length > 0) {
                    XLSX.writeFile(wb, `Report_${startDateString}_to_${endDateString}.xlsx`);
                } else {
                    alert("لا توجد مهام مسجلة في نطاق التاريخ المحدد.");
                }

            } catch (error) {
                console.error("Error fetching date range report:", error);
                alert("حدث خطأ أثناء جلب بيانات التقرير.");
            } finally {
                loadingSpinner.classList.add('hidden');
            }
        };

    </script>
</body>
</html>