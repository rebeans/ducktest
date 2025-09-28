let deferredPrompt;

// 시간/날짜 관련
function getSeoulDate() {
    const now = new Date();
    const seoulTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const year = seoulTime.getFullYear();
    const month = String(seoulTime.getMonth() + 1).padStart(2, '0');
    const day = String(seoulTime.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function getHourMinute(timeString) {
    const str = String(timeString);
    return str.slice(-4);
}

// 데이터 fetch
async function fetchData() {
    const urlArr = `https://rebean.duckdns.org/api/arr`;
    const urlDep = `https://rebean.duckdns.org/api/dep`;

    const [arrResponse, depResponse] = await Promise.all([
        fetch(urlArr),
        fetch(urlDep)
    ]);

    const arrData = await arrResponse.json();
    const depData = await depResponse.json();
    return { arrData, depData };
}

// remark별 class
function getClassName(remark) {
    const classMap = {
        "탑승중": "remark-bor",
        "탑승마감": "remark-bor-e",
        "마감예정": "remark-bor-ee",
        "착륙": "remark-arr"
    };
    return classMap[remark] || "";
}

// 데이터 필터링 + 그룹핑
function filterAndGroupData(dataArr, dataDep, terminalId) {
    const filteredData = [];

    dataArr.response.body.items.forEach(item => {
        if (item.terminalId === terminalId && item.codeshare !== "Slave" && item.remark !== "도착" && item.gateNumber) {
            filteredData.push({
                arr_dep: "↘",
                estimatedDateTime: getHourMinute(item.estimatedDateTime) || "",
                flightId: item.flightId || "",
                gatenumber: item.gateNumber || "",
                remark: item.remark || "",
                class_name: getClassName(item.remark)
            });
        }
    });

    dataDep.response.body.items.forEach(item => {
        if (item.terminalId === terminalId && item.codeshare !== "Slave" && item.remark !== "출발" && item.gateNumber) {
            let remark = item.remark;
            if (["체크인오픈", "탑승준비", "체크인마감"].includes(remark)) remark = "";
            filteredData.push({
                arr_dep: "↗",
                estimatedDateTime: getHourMinute(item.estimatedDateTime) || "",
                flightId: item.flightId || "",
                gatenumber: item.gateNumber || "",
                remark: remark || "",
                class_name: getClassName(remark)
            });
        }
    });

    const gateData = {};
    filteredData.forEach(item => {
        const gateNumber = item.gatenumber;
        if (!gateData[gateNumber]) gateData[gateNumber] = { gatenumber: gateNumber, flights: [] };
        gateData[gateNumber].flights.push(item);
    });

    Object.values(gateData).forEach(gate => {
        gate.flights.sort((a, b) => new Date(a.estimatedDateTime) - new Date(b.estimatedDateTime));
    });

    return gateData;
}

// 터미널별 정렬 그룹
function customGateSort(gateNumbers, terminalId) {
    let groups = [];

    if (terminalId === "P01") groups = [
        [1, 2, 3, 6, 7, 8], [9, 10, 11], [12, 14, 15], [16, 17, 18],
        [19, 20, 21], [22, 23, 24], [26, 27, 28], [30, 31, 32],
        [33, 34, 35], [36, 37, 38], [39, 40, 41], [42, 43, 45], [46, 47, 48, 49, 50]
    ];
    else if (terminalId === "P02") groups = [
        [101, 102, 103, 104, 105, 106], [107, 109, 111, 113], [108, 110, 112, 114],
        [115, 117, 119], [118, 122, 124], [121, 123, 125], [126, 128, 130], [127, 129, 131, 132]
    ];
    else if (terminalId === "P03") groups = [
        [208, 209, 210, 211, 213, 214, 216, 217], [218, 219, 220, 221], [222, 224, 225],
        [231, 232, 233], [234, 235, 236, 238], [239, 241, 242, 243],
        [245, 246, 247], [248, 249, 250], [251, 252, 253], [254, 255, 256],
        [257, 258, 260, 261], [263, 264, 265], [266, 267, 268],
        [275, 276, 277], [278, 279, 280, 281], [282, 283, 285, 287, 289, 290]
    ];

    const gateNumberMap = Object.fromEntries(gateNumbers.map(num => [parseInt(num, 10), num]));
    const sortedWithGroups = [];
    groups.forEach((group, groupIndex) => {
        group.forEach(num => {
            if (gateNumberMap[num]) sortedWithGroups.push({ gateNumber: gateNumberMap[num], groupIndex });
        });
    });

    return sortedWithGroups;
}

// 테이블 생성
function createFlightTable(gateData, terminalId) {
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>';
    const maxFlights = Math.max(...Object.values(gateData).map(g => g.flights.length));
    for (let i = 0; i < maxFlights; i++) headerRow.innerHTML += `<th>${i + 1}</th>`;
    table.appendChild(headerRow);

    const sortedGateEntries = customGateSort(Object.keys(gateData), terminalId);
    sortedGateEntries.forEach(({ gateNumber, groupIndex }) => {
        const gate = gateData[gateNumber];
        if (!gate) return;

        const row = document.createElement('tr');
        if (groupIndex % 2 === 1) row.style.backgroundColor = '#eeeeee';
        row.innerHTML = `<td class="sticky-col">${gateNumber}</td>`;

        gate.flights.forEach(flight => {
            const className = flight.class_name;
            let arrowColor = flight.arr_dep === "↘" ? '#008000' : '#004080';

            let cellContent = '<div class="content-all">';
            cellContent += `<p class="compact"><span style="color: ${arrowColor}; font-weight: bold; font-size: 1.2em;">${flight.arr_dep}</span>${flight.estimatedDateTime}</p>`;
            cellContent += `<p class="compact">${flight.flightId}</p>`;
            cellContent += `<p class="compact">${flight.remark}</p>`;
            cellContent += '</div>';

            row.innerHTML += `<td class="${className}">${cellContent}</td>`;
        });

        for (let i = 0; i < maxFlights - gate.flights.length; i++) row.innerHTML += '<td></td>';
        table.appendChild(row);
    });

    return table;
}

// 테이블 렌더링
function updateData(gateData, terminalId) {
    const container = document.getElementById('flight-info');
    const oldTable = container.querySelector('table');
    const newTable = createFlightTable(gateData, terminalId);

    if (!oldTable || oldTable.outerHTML !== newTable.outerHTML) {
        if (oldTable) container.removeChild(oldTable);
        container.appendChild(newTable);
    }
}

// 길게 누르기 기능
let timer, longPressDelay = 500, startX, startY, isDragging = false;
function handleLongPress(cell) {
    const div = cell.querySelector('div');
    if (!div) return;
    const paragraphs = div.getElementsByTagName('p');
    if (paragraphs.length >= 2) {
        let flightNumber = paragraphs[1].innerText.trim();
        if (flightNumber) {
            flightNumber = flightNumber.replace(/^([A-Z]+)0+/, '$1');
            window.location.href = `https://www.flightradar24.com/${flightNumber}?force_browser=1`;
        }
    }
}
function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
function handleMouseMove(event) { if (Math.abs(event.pageX - startX) > 10 || Math.abs(event.pageY - startY) > 10) { isDragging = true; clearTimer(); } }
function getDistance(t1, t2) { return Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY); }
function detectPinchZoomOrDrag(event) {
    if (event.touches.length === 2) {
        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        if (Math.abs(currentDistance - touchStartDistance) > 10) clearTimer();
    } else if (event.touches.length === 1) {
        if (Math.abs(event.touches[0].pageX - startX) > 10 || Math.abs(event.touches[0].pageY - startY) > 10) { isDragging = true; clearTimer(); }
    }
}

// 터미널 버튼 생성
function createTerminalButtons() {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.right = '0';
    container.style.transform = 'translateY(-50%)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '300px';
    container.style.justifyContent = 'space-between';
    container.style.padding = '5px';
    container.style.zIndex = '10000';

    const terminals = [
        { name: "제1여객터미널", value: "P01" },
        { name: "탑승동", value: "P02" },
        { name: "제2여객터미널", value: "P03" }
    ];

    terminals.forEach(t => {
        const btn = document.createElement('button');
        btn.textContent = t.name;
        btn.style.width = '110px';
        btn.style.height = '70px';
        btn.style.fontSize = '16px';
        btn.style.fontWeight = 'bold';
        btn.style.background = '#2196F3';
        btn.style.color = 'white';
        btn.style.background = 'rgba(33, 150, 243, 0.5)'; // 반투명 파란색
        btn.style.border = 'none';
        btn.style.borderRadius = '8px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', async () => {
            const { arrData, depData } = await fetchData();
            const gateData = filterAndGroupData(arrData, depData, t.value);
            updateData(gateData, t.value);
        });
        container.appendChild(btn);
    });

    document.body.appendChild(container);
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    createTerminalButtons();

    const refreshBtn = document.getElementById('refresh-button');
    refreshBtn.classList.add('loading');

    const { arrData, depData } = await fetchData();
    const gateData = filterAndGroupData(arrData, depData, "P03"); // 초기 P03
    updateData(gateData, "P03");

    refreshBtn.classList.remove('loading');
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('loading');
        const scrollX = window.scrollX, scrollY = window.scrollY;
        const { arrData, depData } = await fetchData();
        const gateData = filterAndGroupData(arrData, depData, "P03"); // 현재 선택 터미널에 맞춰 적용 가능
        updateData(gateData, "P03");
        setTimeout(() => window.scrollTo(scrollX, scrollY), 0);
        refreshBtn.classList.remove('loading');
    });

    const table = document.getElementById('flight-info');
    table.addEventListener('mousedown', startMouseTimer);
    table.addEventListener('mouseup', clearTimer);
    table.addEventListener('mouseleave', clearTimer);
    table.addEventListener('mousemove', handleMouseMove);
    table.addEventListener('touchstart', startTouchTimer);
    table.addEventListener('touchend', clearTimer);
    table.addEventListener('touchcancel', clearTimer);
    table.addEventListener('touchmove', detectPinchZoomOrDrag);
});

// 마우스/터치 이벤트
function startMouseTimer(event) {
    const cell = event.target.closest('td'); if (!cell) return;
    clearTimer(); isDragging = false; startX = event.pageX; startY = event.pageY;
    timer = setTimeout(() => { if (!isDragging) handleLongPress(cell); }, longPressDelay);
}
function startTouchTimer(event) {
    const cell = event.target.closest('td'); if (!cell) return;
    clearTimer(); isDragging = false;
    if (event.touches.length === 1) {
        startX = event.touches[0].pageX; startY = event.touches[0].pageY;
        timer = setTimeout(() => { if (!isDragging) handleLongPress(cell); }, longPressDelay);
    } else if (event.touches.length === 2) touchStartDistance = getDistance(event.touches[0], event.touches[1]);
}
