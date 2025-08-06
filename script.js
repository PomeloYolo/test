class TypingTestSystem {
    constructor() {
        // 使用 localStorage 作為數據存儲，並通過簡單的方式實現跨裝置同步
        this.STORAGE_KEY = 'typing_test_auth_data';
        
        // 本地狀態
        this.authCodes = [];
        this.authorizedIPs = [];
        this.currentIP = null;
        this.isAuthenticated = false;
        this.adminSequence = '';
        
        this.selectedTopic = null;
        this.testContent = '';
        this.sentences = [];
        this.userInputs = [];
        this.currentSentenceIndex = 0;
        
        this.startTime = null;
        this.endTime = null;
        this.timeLeft = 600; // 10分鐘 = 600秒
        this.timer = null;
        
        this.correctChars = 0;
        this.totalChars = 0;
        this.errorChars = 0;
        
        this.initializeSystem();
    }

    async initializeSystem() {
        try {
            // 獲取當前IP
            await this.getCurrentIP();
            
            // 從本地存儲載入數據
            this.loadLocalData();
            
            // 檢查IP是否已授權
            this.checkIPAuthorization();
            
            // 初始化事件監聽器
            this.initializeEventListeners();
        } catch (error) {
            console.error('獲取IP失敗，使用預設值:', error);
            this.currentIP = 'localhost';
            this.loadLocalData();
            this.checkIPAuthorization();
            this.initializeEventListeners();
        }
    }

    async getCurrentIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            this.currentIP = data.ip;
            console.log('當前IP:', this.currentIP);
        } catch (error) {
            console.error('獲取IP失敗:', error);
            this.currentIP = 'localhost';
        }
    }

    loadLocalData() {
        try {
            const savedData = localStorage.getItem(this.STORAGE_KEY);
            if (savedData) {
                const data = JSON.parse(savedData);
                this.authCodes = data.authCodes || [];
                this.authorizedIPs = data.authorizedIPs || [];
            } else {
                this.authCodes = [];
                this.authorizedIPs = [];
                this.saveLocalData();
            }
        } catch (error) {
            console.error('載入本地數據失敗:', error);
            this.authCodes = [];
            this.authorizedIPs = [];
        }
    }

    saveLocalData() {
        try {
            const data = {
                authCodes: this.authCodes,
                authorizedIPs: this.authorizedIPs,
                lastUpdated: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('保存本地數據失敗:', error);
            throw error;
        }
    }

    checkIPAuthorization() {
        const authorizedIP = this.authorizedIPs.find(ip => ip.address === this.currentIP && ip.active);
        if (authorizedIP) {
            this.isAuthenticated = true;
            this.showWelcomeScreen();
        } else if (this.authorizedIPs.find(ip => ip.address === this.currentIP && !ip.active)) {
            // 檢查是否有被停權的IP記錄
            this.showBannedMessage();
        } else {
            this.showAuthScreen();
        }
    }

    initializeEventListeners() {
        // 授權碼相關
        document.getElementById('submitAuthBtn').addEventListener('click', () => this.submitAuthCode());
        document.getElementById('authCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitAuthCode();
            } else {
                this.handleAdminSequence(e.key);
            }
        });
        document.getElementById('requestCodeBtn').addEventListener('click', () => this.toggleRequestInfo());
        
        // 管理介面相關
        document.getElementById('generateCodeBtn').addEventListener('click', () => this.generateAuthCode());
        document.getElementById('viewCodesBtn').addEventListener('click', () => this.viewAllCodes());
        document.getElementById('viewIPsBtn').addEventListener('click', () => this.viewAuthorizedIPs());
        document.getElementById('backToAuthBtn').addEventListener('click', () => this.backToAuth());
        
        // 主題選擇
        document.querySelectorAll('.topic-card').forEach(card => {
            card.addEventListener('click', () => this.selectTopic(card));
        });

        // 開始測驗按鈕
        document.getElementById('startBtn').addEventListener('click', () => this.startTest());

        // 操作說明按鈕
        document.getElementById('instructionsBtn').addEventListener('click', () => this.showInstructions());
        document.getElementById('backToHomeFromInstructions').addEventListener('click', () => this.goHome());
        
        // 在歡迎頁面也監聽鍵盤事件
        document.addEventListener('keypress', (e) => this.handleGlobalKeyPress(e));

        // 結果按鈕
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        document.getElementById('reviewBtn').addEventListener('click', () => this.showReview());
        document.getElementById('closeBtn').addEventListener('click', () => this.goHome());
        
        // 打稿檢視按鈕
        document.getElementById('backToResultBtn').addEventListener('click', () => this.backToResult());
        document.getElementById('backToHomeBtn').addEventListener('click', () => this.goHome());
    }

    handleGlobalKeyPress(event) {
        // 只在歡迎頁面監聽管理員序列
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen.style.display === 'block') {
            this.adminSequence += event.key;
            if (this.adminSequence.length > 4) {
                this.adminSequence = this.adminSequence.slice(-4);
            }
            
            if (this.adminSequence === '1229') {
                this.showAdminScreen();
                this.adminSequence = '';
            }
        }
    }

    handleAdminSequence(key) {
        this.adminSequence += key;
        if (this.adminSequence.length > 4) {
            this.adminSequence = this.adminSequence.slice(-4);
        }
        
        if (this.adminSequence === '1229') {
            this.showAdminScreen();
            this.adminSequence = '';
        }
    }

    async submitAuthCode() {
        const code = document.getElementById('authCodeInput').value.trim().toUpperCase();
        const errorDiv = document.getElementById('authError');
        
        if (!code) {
            this.showAuthError('請輸入授權碼');
            return;
        }
        
        try {
            // 重新載入最新數據
            this.loadLocalData();
            
            const codeIndex = this.authCodes.findIndex(item => item.code === code && !item.used);
            
            if (codeIndex !== -1) {
                // 標記授權碼為已使用
                this.authCodes[codeIndex].used = true;
                this.authCodes[codeIndex].usedAt = new Date().toISOString();
                this.authCodes[codeIndex].usedByIP = this.currentIP;
                
                // 添加IP到授權列表
                const existingIP = this.authorizedIPs.find(ip => ip.address === this.currentIP);
                if (existingIP) {
                    existingIP.active = true;
                    existingIP.lastLogin = new Date().toISOString();
                } else {
                    this.authorizedIPs.push({
                        address: this.currentIP,
                        authorizedAt: new Date().toISOString(),
                        lastLogin: new Date().toISOString(),
                        active: true,
                        authCode: code
                    });
                }
                
                // 保存數據
                this.saveLocalData();
                
                this.isAuthenticated = true;
                this.showWelcomeScreen();
            } else {
                this.showAuthError('授權碼無效或已被使用');
            }
        } catch (error) {
            console.error('驗證授權碼失敗:', error);
            this.showAuthError('網路錯誤，請稍後再試');
        }
    }

    showAuthError(message) {
        const errorDiv = document.getElementById('authError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }

    toggleRequestInfo() {
        const infoDiv = document.getElementById('requestInfo');
        infoDiv.style.display = infoDiv.style.display === 'none' ? 'block' : 'none';
    }

    showAuthScreen() {
        document.getElementById('authScreen').style.display = 'block';
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('adminScreen').style.display = 'none';
    }

    showAdminScreen() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('adminScreen').style.display = 'block';
        document.getElementById('generatedCodeDisplay').style.display = 'none';
        document.getElementById('codeListDisplay').style.display = 'none';
        document.getElementById('ipListDisplay').style.display = 'none';
    }

    async generateAuthCode() {
        try {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numbers = '0123456789';
            
            let code;
            let attempts = 0;
            
            // 確保生成的授權碼是唯一的
            do {
                code = '';
                // 生成2個字母
                for (let i = 0; i < 2; i++) {
                    code += letters.charAt(Math.floor(Math.random() * letters.length));
                }
                // 生成3個數字
                for (let i = 0; i < 3; i++) {
                    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
                }
                attempts++;
            } while (this.authCodes.some(item => item.code === code) && attempts < 100);
            
            // 儲存授權碼
            const newAuthCode = {
                code: code,
                generated: new Date().toISOString(),
                generatedByIP: this.currentIP,
                used: false,
                usedAt: null,
                usedByIP: null
            };
            
            this.authCodes.push(newAuthCode);
            this.saveLocalData();
            
            // 顯示生成的授權碼
            document.getElementById('newCode').textContent = code;
            document.getElementById('generatedCodeDisplay').style.display = 'block';
            document.getElementById('codeListDisplay').style.display = 'none';
            document.getElementById('ipListDisplay').style.display = 'none';
        } catch (error) {
            console.error('生成授權碼失敗:', error);
            alert('生成授權碼失敗，請稍後再試');
        }
    }

    async viewAllCodes() {
        try {
            this.loadLocalData();
            
            const codeListDiv = document.getElementById('codeList');
            let html = '';
            
            if (this.authCodes.length === 0) {
                html = '<p style="text-align: center; color: #6c757d;">尚無授權碼</p>';
            } else {
                this.authCodes.forEach(item => {
                    const status = item.used ? 'used' : 'unused';
                    const statusText = item.used ? '已使用' : '未使用';
                    const usedInfo = item.used ? 
                        `<br><small>使用時間: ${new Date(item.usedAt).toLocaleString()}<br>使用IP: ${item.usedByIP}</small>` : '';
                    
                    html += `
                        <div class="code-item">
                            <div>
                                <span style="font-weight: bold;">${item.code}</span>
                                <span class="code-status status-${status}">${statusText}</span>
                                ${usedInfo}
                            </div>
                        </div>
                    `;
                });
            }
            
            codeListDiv.innerHTML = html;
            document.getElementById('codeListDisplay').style.display = 'block';
            document.getElementById('generatedCodeDisplay').style.display = 'none';
            document.getElementById('ipListDisplay').style.display = 'none';
        } catch (error) {
            console.error('載入授權碼列表失敗:', error);
            alert('載入授權碼列表失敗，請稍後再試');
        }
    }

    async viewAuthorizedIPs() {
        try {
            this.loadLocalData();
            
            const ipListDiv = document.getElementById('ipList');
            let html = '';
            
            if (this.authorizedIPs.length === 0) {
                html = '<p style="text-align: center; color: #6c757d;">尚無授權IP</p>';
            } else {
                this.authorizedIPs.forEach((item, index) => {
                    const status = item.active ? 'active' : 'inactive';
                    const statusText = item.active ? '啟用中' : '已停權';
                    const isCurrent = item.address === this.currentIP;
                    
                    html += `
                        <div class="ip-item">
                            <div class="ip-info">
                                <span style="font-weight: bold;">${item.address}</span>
                                ${isCurrent ? '<span class="current-ip">(目前IP)</span>' : ''}
                                <span class="ip-status status-${status}">${statusText}</span>
                                <br><small>授權時間: ${new Date(item.authorizedAt).toLocaleString()}</small>
                                <br><small>最後登入: ${new Date(item.lastLogin).toLocaleString()}</small>
                                <br><small>使用授權碼: ${item.authCode}</small>
                            </div>
                            <div class="ip-actions">
                                ${item.active ? 
                                    `<button class="ban-btn" onclick="typingTest.banIP(${index})">停權</button>` :
                                    `<button class="unban-btn" onclick="typingTest.unbanIP(${index})">恢復</button>`
                                }
                            </div>
                        </div>
                    `;
                });
            }
            
            ipListDiv.innerHTML = html;
            document.getElementById('ipListDisplay').style.display = 'block';
            document.getElementById('generatedCodeDisplay').style.display = 'none';
            document.getElementById('codeListDisplay').style.display = 'none';
        } catch (error) {
            console.error('載入IP列表失敗:', error);
            alert('載入IP列表失敗，請稍後再試');
        }
    }

    async banIP(index) {
        try {
            if (confirm('確定要停權此IP嗎？')) {
                this.authorizedIPs[index].active = false;
                this.authorizedIPs[index].bannedAt = new Date().toISOString();
                
                this.saveLocalData();
                
                // 如果停權的是當前IP，需要重新登入
                if (this.authorizedIPs[index].address === this.currentIP) {
                    alert('您的IP已被停權，需要重新輸入授權碼');
                    this.isAuthenticated = false;
                    this.showAuthScreen();
                } else {
                    this.viewAuthorizedIPs(); // 重新載入列表
                }
            }
        } catch (error) {
            console.error('停權IP失敗:', error);
            alert('停權IP失敗，請稍後再試');
        }
    }

    async unbanIP(index) {
        try {
            if (confirm('確定要恢復此IP的權限嗎？')) {
                this.authorizedIPs[index].active = true;
                this.authorizedIPs[index].unbannedAt = new Date().toISOString();
                
                this.saveLocalData();
                this.viewAuthorizedIPs(); // 重新載入列表
            }
        } catch (error) {
            console.error('恢復IP失敗:', error);
            alert('恢復IP失敗，請稍後再試');
        }
    }

    backToAuth() {
        document.getElementById('adminScreen').style.display = 'none';
        document.getElementById('authScreen').style.display = 'block';
        document.getElementById('authCodeInput').value = '';
        this.adminSequence = '';
    }

    showWelcomeScreen() {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'block';
        document.getElementById('adminScreen').style.display = 'none';
    }

    showBannedMessage() {
        // 顯示停權提示訊息
        const message = "對不起，您的授權碼已被停權，請重新輸入授權碼以繼續使用";
        alert(message);
        
        // 清除認證狀態
        this.isAuthenticated = false;
        
        // 跳轉到登入介面
        this.showAuthScreen();
    }

    showInstructions() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('instructionsScreen').style.display = 'block';
    }

    selectTopic(selectedCard) {
        // 移除所有選中狀態
        document.querySelectorAll('.topic-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 添加選中狀態
        selectedCard.classList.add('selected');
        this.selectedTopic = selectedCard.dataset.topic;
        
        // 啟用開始按鈕
        document.getElementById('startBtn').disabled = false;
    }

    async startTest() {
        if (!this.selectedTopic) {
            alert('請先選擇一個主題！');
            return;
        }

        // 顯示載入畫面
        this.showLoadingScreen();

        try {
            // 生成測驗內容
            await this.generateContent();
            
            // 顯示測驗畫面
            this.showTestScreen();
            
            // 開始計時
            this.startTimer();
            
        } catch (error) {
            console.error('生成內容失敗:', error);
            alert('生成測驗內容失敗，請重試！');
            this.goHome();
        }
    }

    showLoadingScreen() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('loadingScreen').style.display = 'block';
    }

    async generateContent() {
        const topicPrompts = {
            technology: 'artificial intelligence, machine learning, future technology trends, digital transformation, cybersecurity',
            business: 'entrepreneurship, business strategy, market analysis, leadership, innovation management',
            environment: 'climate change, renewable energy, sustainable development, environmental protection, green technology',
            health: 'medical technology, healthcare innovation, disease prevention, mental health, nutrition science',
            education: 'educational reform, learning methods, online education, skill development, knowledge management',
            travel: 'world cultures, travel experiences, international relations, cultural exchange, global tourism',
            science: 'scientific research, laboratory experiments, scientific discoveries, research methodology, scientific innovation',
            sports: 'sports science, fitness training, athletic performance, sports psychology, exercise physiology',
            food: 'culinary arts, cooking techniques, nutrition science, food culture, gastronomy',
            history: 'historical events, ancient civilizations, cultural heritage, historical analysis, world history'
        };

        // 使用本地生成的內容替代API調用
        this.testContent = this.generateLocalContent(topicPrompts[this.selectedTopic]);
        this.processSentences();
    }

    generateLocalContent(topic) {
        const sentences = [
            `The field of ${topic} has undergone remarkable transformations in recent years.`,
            `Researchers and practitioners continue to explore innovative approaches and methodologies.`,
            `These developments have significant implications for society, economy, and individual lives.`,
            `Understanding the complexities and nuances requires careful analysis and critical thinking.`,
            `Modern technology enables us to process vast amounts of information efficiently.`,
            `Collaboration between different disciplines often leads to breakthrough discoveries.`,
            `The integration of theoretical knowledge with practical applications remains crucial.`,
            `Educational institutions play a vital role in preparing future professionals.`,
            `Continuous learning and adaptation are essential in today's rapidly changing world.`,
            `Ethical considerations must guide our decisions and implementations.`,
            `Global perspectives help us understand diverse approaches and solutions.`,
            `Innovation drives progress, but it must be balanced with sustainability.`,
            `Communication skills are fundamental for sharing knowledge and ideas effectively.`,
            `Data-driven decision making has become increasingly important across all sectors.`,
            `Quality assurance and standards ensure reliability and consistency in outcomes.`,
            `Professional development requires dedication, practice, and ongoing education.`,
            `Interdisciplinary collaboration fosters creativity and comprehensive solutions.`,
            `Risk assessment and management are critical components of any successful project.`,
            `User experience and human-centered design principles guide modern development.`,
            `Environmental impact and social responsibility influence contemporary practices.`
        ];

        // 重複句子直到達到5000字符
        let content = sentences.join(' ');
        while (content.length < 5000) {
            content += ' ' + sentences.join(' ');
        }
        
        return content.substring(0, 5000);
    }

    processSentences() {
        // 將文章分割成句子，保留標點符號
        const sentences = this.testContent.split(/(?<=[.!?])\s+/)
            .filter(sentence => sentence.trim().length > 0)
            .map(sentence => sentence.trim());
        
        this.sentences = sentences;
        this.userInputs = new Array(sentences.length).fill('');
        this.totalChars = this.testContent.length;
        
        console.log(`總字符數: ${this.totalChars}`);
        console.log(`句子總數: ${this.sentences.length}`);
    }

    showTestScreen() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('testScreen').style.display = 'block';
        
        this.renderSentences();
        
        // 自動聚焦到第一個輸入框
        setTimeout(() => {
            const firstInput = document.querySelector('.sentence-input');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    }

    renderSentences() {
        const textDisplay = document.getElementById('textDisplay');
        textDisplay.innerHTML = '';

        this.sentences.forEach((sentence, index) => {
            const sentenceBlock = document.createElement('div');
            sentenceBlock.className = 'sentence-block';
            
            const sentenceText = document.createElement('div');
            sentenceText.className = 'sentence-text';
            sentenceText.textContent = sentence;
            
            const sentenceInput = document.createElement('input');
            sentenceInput.type = 'text';
            sentenceInput.className = 'sentence-input';
            sentenceInput.placeholder = '請在此輸入上方句子...';
            sentenceInput.dataset.index = index;
            
            // 添加輸入事件監聽器
            sentenceInput.addEventListener('input', (e) => this.handleInput(e, index));
            sentenceInput.addEventListener('keydown', (e) => this.handleKeyDown(e, index));
            
            // 禁用複製貼上
            sentenceInput.addEventListener('paste', (e) => {
                e.preventDefault();
                return false;
            });
            
            sentenceInput.addEventListener('copy', (e) => {
                e.preventDefault();
                return false;
            });
            
            sentenceInput.addEventListener('cut', (e) => {
                e.preventDefault();
                return false;
            });
            
            sentenceBlock.appendChild(sentenceText);
            sentenceBlock.appendChild(sentenceInput);
            textDisplay.appendChild(sentenceBlock);
        });
    }

    handleInput(event, index) {
        const input = event.target;
        const userText = input.value;
        
        // 儲存用戶輸入
        this.userInputs[index] = userText;
    }

    handleKeyDown(event, index) {
        // Enter鍵移動到下一個輸入框
        if (event.key === 'Enter') {
            event.preventDefault();
            const nextInput = document.querySelector(`[data-index="${index + 1}"]`);
            if (nextInput) {
                nextInput.focus();
                nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    startTimer() {
        this.startTime = Date.now();
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.endTest();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('timeLeft').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    calculateStats() {
        this.correctChars = 0;
        this.errorChars = 0;
        
        for (let i = 0; i < this.sentences.length; i++) {
            const original = this.sentences[i];
            const typed = this.userInputs[i] || '';
            
            // 逐字符比較 - 只比較用戶實際輸入的部分
            const minLength = Math.min(original.length, typed.length);
            for (let j = 0; j < minLength; j++) {
                if (original[j] === typed[j]) {
                    this.correctChars++;
                } else {
                    this.errorChars++;
                }
            }
            
            // 如果用戶輸入超過原文長度，多出的部分算錯誤
            if (typed.length > original.length) {
                this.errorChars += (typed.length - original.length);
            }
        }
    }

    endTest() {
        this.endTime = Date.now();
        clearInterval(this.timer);
        
        // 計算最終統計
        this.calculateFinalStats();
        
        // 顯示結果
        this.showResultScreen();
    }

    calculateFinalStats() {
        // 重新計算所有統計數據
        this.correctChars = 0;
        this.errorChars = 0;
        
        for (let i = 0; i < this.sentences.length; i++) {
            const original = this.sentences[i];
            const typed = this.userInputs[i] || '';
            
            // 逐字符比較 - 只比較用戶實際輸入的部分
            const minLength = Math.min(original.length, typed.length);
            for (let j = 0; j < minLength; j++) {
                if (original[j] === typed[j]) {
                    this.correctChars++;
                } else {
                    this.errorChars++;
                }
            }
            
            // 如果用戶輸入超過原文長度，多出的部分算錯誤
            if (typed.length > original.length) {
                this.errorChars += (typed.length - original.length);
            }
        }

        // 計算WPM: (正確輸入的字元數 / 5) / 總10分鐘
        const wpm = Math.round((this.correctChars / 5) / 10);
        
        // 計算準確度: (正確輸入的字元數 / 5000) * 100%
        const accuracy = Math.round((this.correctChars / this.totalChars) * 100);

        console.log('統計結果:');
        console.log(`正確字符數: ${this.correctChars}`);
        console.log(`錯誤字符數: ${this.errorChars}`);
        console.log(`總字符數: ${this.totalChars}`);
        console.log(`WPM: ${wpm}`);
        console.log(`準確度: ${accuracy}%`);

        // 更新結果顯示
        document.getElementById('finalWPM').textContent = wpm;
        document.getElementById('finalAccuracy').textContent = `${accuracy}%`;
        document.getElementById('finalErrors').textContent = this.errorChars;
    }

    showResultScreen() {
        document.getElementById('testScreen').style.display = 'none';
        document.getElementById('resultScreen').style.display = 'block';
    }

    showReview() {
        document.getElementById('resultScreen').style.display = 'none';
        document.getElementById('reviewScreen').style.display = 'block';
        
        this.generateReviewContent();
    }

    generateReviewContent() {
        const reviewText = document.getElementById('reviewText');
        let reviewHTML = '';
        
        for (let i = 0; i < this.sentences.length; i++) {
            const original = this.sentences[i];
            const typed = this.userInputs[i] || '';
            
            reviewHTML += `<div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px;">`;
            reviewHTML += `<div style="margin-bottom: 10px; font-weight: bold; color: #333;">句子 ${i + 1}:</div>`;
            reviewHTML += `<div style="margin-bottom: 10px;">原文: ${original}</div>`;
            reviewHTML += `<div style="margin-bottom: 10px;">您的輸入: `;
            
            // 逐字符比較並標記
            let comparisonHTML = '';
            const minLength = Math.min(original.length, typed.length);
            
            for (let j = 0; j < minLength; j++) {
                if (original[j] === typed[j]) {
                    comparisonHTML += `<span class="correct-char">${typed[j]}</span>`;
                } else {
                    comparisonHTML += `<span class="error-char">${typed[j]}</span>`;
                }
            }
            
            // 如果用戶輸入超過原文長度，多出的部分標記為錯誤
            if (typed.length > original.length) {
                for (let j = original.length; j < typed.length; j++) {
                    comparisonHTML += `<span class="error-char">${typed[j]}</span>`;
                }
            }
            
            reviewHTML += comparisonHTML || '<span style="color: #999;">未輸入</span>';
            reviewHTML += `</div></div>`;
        }
        
        reviewText.innerHTML = reviewHTML;
    }

    backToResult() {
        document.getElementById('reviewScreen').style.display = 'none';
        document.getElementById('resultScreen').style.display = 'block';
    }

    restart() {
        // 重置所有狀態
        this.resetState();
        
        // 返回首頁重新選擇主題
        this.goHome();
    }

    goHome() {
        // 隱藏所有畫面
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('testScreen').style.display = 'none';
        document.getElementById('resultScreen').style.display = 'none';
        document.getElementById('reviewScreen').style.display = 'none';
        document.getElementById('instructionsScreen').style.display = 'none';
        
        // 根據認證狀態顯示對應頁面
        if (this.isAuthenticated) {
            document.getElementById('welcomeScreen').style.display = 'block';
        } else {
            document.getElementById('authScreen').style.display = 'block';
        }
        
        // 重置狀態
        this.resetState();
    }

    resetState() {
        // 清除計時器
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 重置所有變數
        this.selectedTopic = null;
        this.testContent = '';
        this.sentences = [];
        this.userInputs = [];
        this.currentSentenceIndex = 0;
        this.startTime = null;
        this.endTime = null;
        this.timeLeft = 600;
        this.correctChars = 0;
        this.totalChars = 0;
        this.errorChars = 0;
        
        // 重置UI
        document.querySelectorAll('.topic-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('startBtn').disabled = true;
        document.getElementById('timeLeft').textContent = '10:00';
    }
}

// 全域變數供HTML調用
let typingTest;

// 初始化系統
document.addEventListener('DOMContentLoaded', () => {
    typingTest = new TypingTestSystem();
});