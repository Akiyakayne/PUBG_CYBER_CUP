// Инициализация Google API
async function initGoogleApi() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: CONFIG.API_KEY,
                    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
                });
                console.log('Google API инициализирован');
                resolve();
            } catch (error) {
                console.error('Ошибка инициализации Google API:', error);
                reject(error);
            }
        });
    });
}

// Функция для получения данных через Google Sheets API
async function fetchSheetData(sheetName) {
    try {
        await initGoogleApi();
        
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: sheetName,
        });
        
        const rows = response.result.values;
        
        if (rows && rows.length > 0) {
            const headers = rows[0];
            const data = [];
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const obj = {};
                
                headers.forEach((header, index) => {
                    obj[header] = row[index] || '';
                });
                
                data.push(obj);
            }
            
            return data;
        }
        
        return [];
        
    } catch (error) {
        console.error('Ошибка загрузки через API:', error);
        showUserError(error);
        return await fetchSheetDataPublic(sheetName);
    }
}

// Запасной вариант - публичный доступ
async function fetchSheetDataPublic(sheetName) {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        return parseCSV(csvText);
        
    } catch (error) {
        console.error('Ошибка загрузки (публичный доступ):', error);
        return [];
    }
}

// Парсер CSV
function parseCSV(csvText) {
    if (!csvText || csvText.trim() === '') return [];
    
    const lines = csvText.split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        data.push(row);
    }
    
    return data;
}

// Показать ошибку пользователю
function showUserError(error) {
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.innerHTML = `
        <strong>Ошибка доступа к таблице</strong><br>
        ${error.message || 'Неизвестная ошибка'}<br><br>
        <small>Проверьте доступ к таблице</small>
    `;
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        const loadingEl = tab.querySelector('.loading');
        const containerEl = tab.querySelector('[id$="-container"], [id$="-table-container"]');
        if (loadingEl) loadingEl.style.display = 'none';
        if (containerEl) {
            containerEl.innerHTML = '';
            containerEl.appendChild(errorMessage.cloneNode(true));
            containerEl.style.display = 'block';
        }
    });
}

// Обновить время последнего обновления
function updateLastUpdateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('last-update').textContent = `Последнее обновление: ${formattedTime}`;
}

// Загрузка основной таблицы
async function loadMainTable() {
    const loadingEl = document.getElementById('main-loading');
    const containerEl = document.getElementById('main-table-container');
    
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    
    const data = await fetchSheetData(CONFIG.SHEETS.MAIN);
    
    if (data.length === 0) {
        loadingEl.style.display = 'none';
        containerEl.innerHTML = '<p class="error-message">Нет данных для отображения</p>';
        containerEl.style.display = 'block';
        return;
    }
    
    let html = '<table><thead><tr>';
    html += '<th>Ранг</th><th>Команда</th><th>Матчи</th><th>Очки за места</th><th>Киллы</th><th>Всего очков</th>';
    html += '</tr></thead><tbody>';
    
    data.forEach((row, index) => {
        const rankClass = index < 3 ? ` rank-${index + 1}` : '';
        html += `<tr class="${rankClass}">`;
        html += `<td><strong>${row['Rank'] || index + 1}</strong></td>`;
        html += `<td>${row['Team'] || '-'}</td>`;
        html += `<td>${row['Matches'] || '0'}</td>`;
        html += `<td>${row['Place Pts'] || '0'}</td>`;
        html += `<td>${row['Kills'] || '0'}</td>`;
        html += `<td><strong style="color: #f7b731;">${row['Total Points'] || '0'}</strong></td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    document.getElementById('teams-count').textContent = data.length;
    
    containerEl.innerHTML = html;
    loadingEl.style.display = 'none';
    containerEl.style.display = 'block';
    updateLastUpdateTime();
}

// Загрузка статистики команд
async function loadTeamsStats() {
    const loadingEl = document.getElementById('teams-loading');
    const containerEl = document.getElementById('teams-container');
    
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    
    const data = await fetchSheetData(CONFIG.SHEETS.TEAMS);
    
    if (data.length === 0) {
        loadingEl.style.display = 'none';
        containerEl.innerHTML = '<p class="error-message">Нет данных для отображения</p>';
        containerEl.style.display = 'block';
        return;
    }
    
    let html = '<div class="team-stats">';
    
    data.forEach(row => {
        if (!row['Team Name']) return;
        
        html += '<div class="stat-card">';
        html += `<h3>${row['Team Name']}</h3>`;
        
        const stats = [
            {label: 'Матчи', value: row['Number Of Matches']},
            {label: 'Всего очков', value: row['Total Points']},
            {label: 'WWCD (победы)', value: row['WWCD']},
            {label: 'Очки за места', value: row['Place Pts']},
            {label: 'Киллы', value: row['Kills']},
            {label: 'Ассисты', value: row['Assists']},
            {label: 'Урон', value: row['Damage Dealt']},
            {label: 'Получено урона', value: row['Damage Taken']},
            {label: 'Нокауты', value: row['Knocks']},
            {label: 'Реанимации', value: row['Revives']},
            {label: 'Хедшоты', value: row['Headshot Kills']},
            {label: 'Хилы', value: row['Heals']},
            {label: 'Бусты', value: row['Boosts']}
        ];
        
        stats.forEach(stat => {
            if (stat.value && stat.value !== '0' && stat.value !== '') {
                html += `<div class="stat-row"><span class="stat-label">${stat.label}:</span><span class="stat-value">${stat.value}</span></div>`;
            }
        });
        
        html += '</div>';
    });
    
    html += '</div>';
    
    updateTeamFilter(data);
    
    containerEl.innerHTML = html;
    loadingEl.style.display = 'none';
    containerEl.style.display = 'block';
    updateLastUpdateTime();
}

// Загрузка статистики игроков
async function loadPlayersStats() {
    const loadingEl = document.getElementById('players-loading');
    const containerEl = document.getElementById('players-table-container');
    
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    
    const data = await fetchSheetData(CONFIG.SHEETS.PLAYERS);
    
    if (data.length === 0) {
        loadingEl.style.display = 'none';
        containerEl.innerHTML = '<p class="error-message">Нет данных для отображения</p>';
        containerEl.style.display = 'block';
        return;
    }
    
    let html = '<table><thead><tr>';
    html += '<th>Игрок</th><th>Команда</th><th>Матчи</th><th>Киллы</th><th>Ассисты</th><th>KDA</th><th>Нокауты</th><th>Урон</th><th>Хедшоты</th><th>Longest Kill</th>';
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
        if (!row['Player']) return;
        
        const kills = parseInt(row['Kills'] || 0);
        const assists = parseInt(row['Assists'] || 0);
        const matches = parseInt(row['Number of Matches'] || 1);
        const revives = parseInt(row['Revives'] || 0);
        
        const kda = ((kills + assists) / Math.max(1, matches - revives)).toFixed(2);
        
        html += '<tr>';
        html += `<td><strong>${row['Player']}</strong></td>`;
        html += `<td>${row['Team'] || '-'}</td>`;
        html += `<td>${row['Number of Matches'] || '0'}</td>`;
        html += `<td>${kills}</td>`;
        html += `<td>${assists}</td>`;
        html += `<td>${kda}</td>`;
        html += `<td>${row['Knocks'] || '0'}</td>`;
        html += `<td>${row['Damage Dealt'] || '0'}</td>`;
        html += `<td>${row['Headshot Kills'] || '0'}</td>`;
        html += `<td>${row['Longest Kill (m)'] || '0'}м</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    updatePlayerFilter(data);
    
    containerEl.innerHTML = html;
    loadingEl.style.display = 'none';
    containerEl.style.display = 'block';
    updateLastUpdateTime();
}

// Загрузка таблицы по дням
async function loadDaysTable() {
    const loadingEl = document.getElementById('days-loading');
    const containerEl = document.getElementById('days-table-container');
    
    loadingEl.style.display = 'block';
    containerEl.style.display = 'none';
    
    setTimeout(() => {
        loadingEl.style.display = 'none';
        containerEl.innerHTML = '<p class="info-item" style="padding: 20px; text-align: center;">Таблица по дням находится в разработке</p>';
        containerEl.style.display = 'block';
        updateLastUpdateTime();
    }, 1000);
}

// Обновить фильтр команд
function updateTeamFilter(data) {
    const teamSelect = document.getElementById('teamFilter');
    while (teamSelect.options.length > 1) {
        teamSelect.remove(1);
    }
    
    const teams = new Set();
    data.forEach(row => {
        if (row['Team Name']) {
            teams.add(row['Team Name']);
        }
    });
    
    Array.from(teams).sort().forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamSelect.appendChild(option);
    });
}

// Обновить фильтр игроков
function updatePlayerFilter(data) {
    const playerSelect = document.getElementById('playerFilter');
    while (playerSelect.options.length > 1) {
        playerSelect.remove(1);
    }
    
    const players = new Set();
    data.forEach(row => {
        if (row['Player']) {
            players.add(row['Player']);
        }
    });
    
    Array.from(players).sort().forEach(player => {
        const option = document.createElement('option');
        option.value = player;
        option.textContent = player;
        playerSelect.appendChild(option);
    });
}

// Переключение вкладок
function switchTab(tabName, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    switch(tabName) {
        case 'main':
            loadMainTable();
            break;
        case 'teams':
            loadTeamsStats();
            break;
        case 'players':
            loadPlayersStats();
            break;
        case 'days':
            loadDaysTable();
            break;
    }
}

// Фильтры
function filterByTeam() {
    const team = document.getElementById('teamFilter').value;
    console.log('Фильтр по команде:', team);
}

function filterByPlayer() {
    const player = document.getElementById('playerFilter').value;
    console.log('Фильтр по игроку:', player);
}

// Инициализация
window.onload = async function() {
    await loadMainTable();
    await loadTeamsStats();
    await loadPlayersStats();
};