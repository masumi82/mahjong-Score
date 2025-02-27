// Firebaseの設定
// ※実際に使う前に、ご自身のFirebase設定に置き換えてください
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// コレクション参照
const playersRef = db.collection("players");
const gamesRef = db.collection("games");

// グローバル変数
let players = [];
let games = [];
let performanceChart = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async function() {
    // フォームのイベントリスナー設定
    document.getElementById('gameForm').addEventListener('submit', addGame);
    document.getElementById('playerForm').addEventListener('submit', addPlayer);
    
    // データの初期読み込み
    await loadPlayers();
    await loadGames();
    
    // UIの初期化
    updatePlayerFields();
    updatePlayerSelects();
    updatePlayersTable();
    updateGameHistoryTable();
    
    // 初期プレイヤー統計表示
    if (players.length > 0) {
        const statsSelect = document.getElementById('statsPlayerSelect');
        if (statsSelect.options.length > 0) {
            showPlayerStats();
        }
    }
});

// 日付のフォーマット
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
}

// プレイヤーデータの読み込み
async function loadPlayers() {
    try {
        const snapshot = await playersRef.get();
        players = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("プレイヤーデータの読み込み中にエラーが発生しました:", error);
        alert("プレイヤーデータの読み込みに失敗しました。");
    }
}

// 対局データの読み込み
async function loadGames() {
    try {
        const snapshot = await gamesRef.orderBy("date", "desc").get();
        games = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("対局データの読み込み中にエラーが発生しました:", error);
        alert("対局データの読み込みに失敗しました。");
    }
}

// プレイヤーフィールドの更新
function updatePlayerFields() {
    const playerCount = parseInt(document.getElementById('playerCount').value);
    const playerFields = document.getElementById('playerFields');
    playerFields.innerHTML = '';
    
    for (let i = 1; i <= playerCount; i++) {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'mb-4 p-3 border rounded';
        fieldGroup.innerHTML = `
            <h4>プレイヤー ${i}</h4>
            <div class="mb-3">
                <label for="player${i}" class="form-label">プレイヤー</label>
                <select id="player${i}" class="form-control playerSelect" required></select>
            </div>
            <div class="mb-3">
                <label for="score${i}" class="form-label">点数</label>
                <input type="number" id="score${i}" class="form-control" required>
            </div>
            <div class="mb-3">
                <label for="rank${i}" class="form-label">順位</label>
                <select id="rank${i}" class="form-control" required>
                    <option value="1">1位</option>
                    <option value="2">2位</option>
                    <option value="3">3位</option>
                    ${playerCount === 4 ? '<option value="4">4位</option>' : ''}
                </select>
            </div>
        `;
        playerFields.appendChild(fieldGroup);
    }
    
    updatePlayerSelects();
}

// プレイヤー選択肢の更新
function updatePlayerSelects() {
    const playerSelects = document.getElementsByClassName('playerSelect');
    const statsPlayerSelect = document.getElementById('statsPlayerSelect');
    
    // 統計タブのプレイヤー選択をクリア
    statsPlayerSelect.innerHTML = '';
    
    // 各プレイヤー選択肢を更新
    for (let i = 0; i < playerSelects.length; i++) {
        playerSelects[i].innerHTML = '';
        
        players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            playerSelects[i].appendChild(option.cloneNode(true));
        });
    }
    
    // 統計タブのプレイヤー選択も更新
    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        statsPlayerSelect.appendChild(option);
    });
}

// プレイヤー追加
async function addPlayer(event) {
    event.preventDefault();
    
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) return;
    
    // 既存のプレイヤーと重複チェック
    if (players.some(p => p.name === playerName)) {
        alert('同じ名前のプレイヤーが既に存在します。');
        return;
    }
    
    try {
        // Firestoreに追加
        const newPlayerRef = await playersRef.add({
            name: playerName,
            created: new Date().toISOString()
        });
        
        // メモリ上の配列に追加
        const newPlayer = {
            id: newPlayerRef.id,
            name: playerName,
            created: new Date().toISOString()
        };
        
        players.push(newPlayer);
        
        // UI更新
        document.getElementById('playerName').value = '';
        updatePlayerSelects();
        updatePlayersTable();
        
        alert('プレイヤーを追加しました。');
    } catch (error) {
        console.error("プレイヤー追加中にエラーが発生しました:", error);
        alert("プレイヤーの追加に失敗しました。");
    }
}

// プレイヤーテーブルの更新
function updatePlayersTable() {
    const tbody = document.getElementById('playersTableBody');
    tbody.innerHTML = '';
    
    if (players.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" class="text-center">プレイヤーが登録されていません</td>';
        tbody.appendChild(row);
        return;
    }
    
    players.forEach(player => {
        // プレイヤーの参加した対局数をカウント
        const gameCount = games.filter(game => 
            game.results.some(result => result.playerId === player.id)
        ).length;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.name}</td>
            <td>${gameCount}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="confirmDeletePlayer('${player.id}')">削除</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// プレイヤー削除確認
function confirmDeletePlayer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const gameCount = games.filter(game => 
        game.results.some(result => result.playerId === playerId)
    ).length;
    
    let message = `プレイヤー「${player.name}」を削除しますか？`;
    if (gameCount > 0) {
        message += `\n\n注意: このプレイヤーは${gameCount}回の対局に参加しています。`;
    }
    
    if (confirm(message)) {
        deletePlayer(playerId);
    }
}

// プレイヤー削除
async function deletePlayer(playerId) {
    try {
        // Firestoreから削除
        await playersRef.doc(playerId).delete();
        
        // メモリ上の配列から削除
        players = players.filter(p => p.id !== playerId);
        
        // 関連する対局データは残しておく（履歴として）
        
        // UI更新
        updatePlayerSelects();
        updatePlayersTable();
        updateGameHistoryTable();
        
        alert('プレイヤーを削除しました。');
    } catch (error) {
        console.error("プレイヤー削除中にエラーが発生しました:", error);
        alert("プレイヤーの削除に失敗しました。");
    }
}

// 対局追加
async function addGame(event) {
    event.preventDefault();
    
    const gameDate = document.getElementById('gameDate').value;
    const playerCount = parseInt(document.getElementById('playerCount').value);
    
    const results = [];
    const usedPlayers = new Set();
    
    for (let i = 1; i <= playerCount; i++) {
        const playerId = document.getElementById(`player${i}`).value;
        const score = parseInt(document.getElementById(`score${i}`).value);
        const rank = parseInt(document.getElementById(`rank${i}`).value);
        
        // 同じプレイヤーが重複して選択されていないかチェック
        if (usedPlayers.has(playerId)) {
            alert('同じプレイヤーが複数選択されています。');
            return;
        }
        usedPlayers.add(playerId);
        
        results.push({ playerId, score, rank });
    }
    
    // 順位の妥当性をチェック
    const ranks = results.map(r => r.rank);
    const expectedRanks = Array.from({length: playerCount}, (_, i) => i + 1);
    if (!expectedRanks.every(r => ranks.includes(r))) {
        alert('順位に重複または欠落があります。');
        return;
    }
    
    try {
        // 対局データ作成
        const gameData = {
            date: gameDate,
            playerCount: playerCount,
            results: results,
            timestamp: new Date().toISOString()
        };
        
        // Firestoreに追加
        const newGameRef = await gamesRef.add(gameData);
        
        // メモリ上の配列に追加
        const newGame = {
            id: newGameRef.id,
            ...gameData
        };
        
        games.unshift(newGame); // 新しい対局を先頭に追加
        
        // フォームをリセット
        document.getElementById('gameForm').reset();
        updatePlayerFields();
        updateGameHistoryTable();
        updatePlayersTable();
        
        alert('対局が記録されました。');
    } catch (error) {
        console.error("対局追加中にエラーが発生しました:", error);
        alert("対局の記録に失敗しました。");
    }
}

// 対局履歴テーブルの更新
function updateGameHistoryTable() {
    const tbody = document.getElementById('gameHistoryTableBody');
    tbody.innerHTML = '';
    
    if (games.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">対局データがありません</td>';
        tbody.appendChild(row);
        return;
    }
    
    // 各対局の結果をテーブルに表示
    games.forEach(game => {
        // 各プレイヤーの結果ごとに行を作成
        game.results.forEach(result => {
            const player = players.find(p => p.id === result.playerId);
            const playerName = player ? player.name : '不明なプレイヤー';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(game.date)}</td>
                <td>${playerName}</td>
                <td class="rank-${result.rank}">${result.rank}位</td>
                <td>${result.score.toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteGame('${game.id}')">削除</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // 対局ごとに区切り線を追加
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = '<td colspan="5" class="bg-light" style="height: 5px;"></td>';
        tbody.appendChild(separatorRow);
    });
}

// 対局削除確認
function confirmDeleteGame(gameId) {
    if (confirm('この対局を削除しますか？')) {
        deleteGame(gameId);
    }
}

// 対局削除
async function deleteGame(gameId) {
    try {
        // Firestoreから削除
        await gamesRef.doc(gameId).delete();
        
        // メモリ上の配列から削除
        games = games.filter(g => g.id !== gameId);
        
        // UI更新
        updateGameHistoryTable();
        updatePlayersTable();
        
        alert('対局を削除しました。');
    } catch (error) {
        console.error("対局削除中にエラーが発生しました:", error);
        alert("対局の削除に失敗しました。");
    }
}

// プレイヤー統計表示
function showPlayerStats() {
    const playerId = document.getElementById('statsPlayerSelect').value;
    if (!playerId) return;
    
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    document.getElementById('playerStatsContainer').innerHTML = `
        <div class="loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    // プレイヤーの参加した対局を取得
    const playerGames = games.filter(game => 
        game.results.some(result => result.playerId === playerId)
    );
    
    // プレイヤーの結果を取得
    const playerResults = [];
    playerGames.forEach(game => {
        const result = game.results.find(r => r.playerId === playerId);
        if (result) {
            playerResults.push({
                gameId: game.id,
                date: game.date,
                playerCount: game.playerCount,
                ...result
            });
        }
    });
    
    // 統計計算
    const totalGames = playerResults.length;
    if (totalGames === 0) {
        document.getElementById('playerStatsContainer').innerHTML = '<div class="alert alert-info">対局データがありません。</div>';
        return;
    }
    
    // 3人打ちと4人打ちで分ける
    const games3p = playerResults.filter(r => r.playerCount === 3);
    const games4p = playerResults.filter(r => r.playerCount === 4);
    
    // 全体の統計
    const avgRank = playerResults.reduce((sum, r) => sum + r.rank, 0) / totalGames;
    const topRate = playerResults.filter(r => r.rank === 1).length / totalGames * 100;
    const avgScore = playerResults.reduce((sum, r) => sum + r.score, 0) / totalGames;
    
    // 3人打ちの統計
    const avgRank3p = games3p.length ? games3p.reduce((sum, r) => sum + r.rank, 0) / games3p.length : 0;
    const topRate3p = games3p.length ? games3p.filter(r => r.rank === 1).length / games3p.length * 100 : 0;
    
    // 4人打ちの統計
    const avgRank4p = games4p.length ? games4p.reduce((sum, r) => sum + r.rank, 0) / games4p.length : 0;
    const topRate4p = games4p.length ? games4p.filter(r => r.rank === 1).length / games4p.length * 100 : 0;
    
    // 最近の調子（直近10局）
    const recent10 = [...playerResults].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    const recentAvgRank = recent10.length ? recent10.reduce((sum, r) => sum + r.rank, 0) / recent10.length : 0;
    const recentTopRate = recent10.length ? recent10.filter(r => r.rank === 1).length / recent10.length * 100 : 0;
    
    // 順位ごとの回数
    const rankCounts = [1, 2, 3, 4].map(rank => ({
        rank: rank,
        count: playerResults.filter(r => r.rank === rank).length,
        percentage: (playerResults.filter(r => r.rank === rank).length / totalGames * 100).toFixed(1)
    })).filter(rc => rc.count > 0);
    
    // HTML生成
    const statsHTML = `
        <h3>${player.name} の成績</h3>
        
        <div class="row stats-summary">
            <div class="col-md-3 col-sm-6">
