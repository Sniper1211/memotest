// 声音效果类
class SoundEffect {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.baseFrequency = 440;
    }

    async playTone(frequency, duration, type = 'sine', gain = 0.5) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(gain, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);

        return new Promise(resolve => setTimeout(resolve, duration * 1000));
    }

    async playSuccess() {
        await this.playTone(this.baseFrequency * 2, 0.15);
        await this.playTone(this.baseFrequency * 3, 0.15);
    }

    async playError() {
        await this.playTone(this.baseFrequency / 2, 0.2, 'square');
    }

    async playTileSound(index) {
        const frequencies = [
            this.baseFrequency,
            this.baseFrequency * 9/8,
            this.baseFrequency * 5/4,
            this.baseFrequency * 4/3,
            this.baseFrequency * 3/2,
            this.baseFrequency * 5/3,
            this.baseFrequency * 15/8,
            this.baseFrequency * 2
        ];
        await this.playTone(frequencies[index % frequencies.length], 0.15);
    }
}

// 游戏核心类
class MemoryGame {
    constructor() {
        this.gridSize = 3;
        this.tiles = [];
        this.sequence = [];
        this.playerSequence = [];
        this.isPlaying = false;
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.level = 1;
        
        // DOM 元素
        this.gameGrid = document.getElementById('gameGrid');
        this.startButton = document.getElementById('startButton');
        this.resetButton = document.getElementById('resetButton');
        this.scoreDisplay = document.getElementById('score');
        this.levelDisplay = document.getElementById('level');
        this.bestScoreDisplay = document.getElementById('bestScore');
        this.statusDisplay = document.getElementById('gameStatus');

        // 初始化声音系统
        this.sound = new SoundEffect();
        
        this.init();
        this.updateDisplays();
    }
    
    init() {
        this.createGrid();
        this.bindEvents();
        this.bestScoreDisplay.textContent = this.bestScore;
        this.setStatus('Press Start to play!');
    }
    
    createGrid() {
        this.gameGrid.innerHTML = '';
        this.tiles = [];
        
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.index = i;
            this.gameGrid.appendChild(tile);
            this.tiles.push(tile);
        }
    }
    
    bindEvents() {
        this.startButton.addEventListener('click', () => this.startGame());
        this.resetButton.addEventListener('click', () => this.resetGame());
        
        this.tiles.forEach(tile => {
            tile.addEventListener('click', (e) => this.handleTileClick(e));
        });

        // 添加键盘支持
        document.addEventListener('keydown', (e) => {
            const keyToIndex = {
                '1': 0, '2': 1, '3': 2,
                '4': 3, '5': 4, '6': 5,
                '7': 6, '8': 7, '9': 8
            };
            
            if (keyToIndex.hasOwnProperty(e.key)) {
                const index = keyToIndex[e.key];
                if (index < this.tiles.length) {
                    this.handleTileClick({ target: this.tiles[index] });
                }
            }
        });
    }
    
    updateDisplays() {
        this.scoreDisplay.textContent = this.score;
        this.levelDisplay.textContent = this.level;
        this.bestScoreDisplay.textContent = this.bestScore;
    }
    
    async startGame() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.sequence = [];
        this.playerSequence = [];
        this.startButton.disabled = true;
        
        this.setStatus('Watch the sequence...');
        
        // 根据当前等级生成序列
        const sequenceLength = Math.min(3 + this.level - 1, 9);
        for (let i = 0; i < sequenceLength; i++) {
            this.sequence.push(Math.floor(Math.random() * (this.gridSize * this.gridSize)));
        }
        
        // 播放序列
        await this.playSequence();
        this.setStatus('Your turn! Repeat the sequence.');
        this.startButton.disabled = false;
    }
    
    async playSequence() {
        for (let index of this.sequence) {
            await this.activateTile(index, 500);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    async activateTile(index, duration) {
        const tile = this.tiles[index];
        tile.classList.add('active');
        await this.sound.playTileSound(index);
        
        await new Promise(resolve => setTimeout(resolve, duration));
        
        tile.classList.remove('active');
    }
    
    handleTileClick(e) {
        if (!this.isPlaying) return;
        
        const index = parseInt(e.target.dataset.index);
        this.playerSequence.push(index);
        
        const currentIndex = this.playerSequence.length - 1;
        
        if (this.sequence[currentIndex] === index) {
            // 正确点击
            e.target.classList.add('success');
            this.sound.playTileSound(index);
            setTimeout(() => e.target.classList.remove('success'), 300);
            
            if (this.playerSequence.length === this.sequence.length) {
                // 完成当前序列
                this.score += this.sequence.length * 10;
                if (this.score > this.bestScore) {
                    this.bestScore = this.score;
                    localStorage.setItem('bestScore', this.bestScore);
                }
                this.level++;
                this.updateDisplays();
                
                this.isPlaying = false;
                setTimeout(() => {
                    this.sound.playSuccess();
                    this.setStatus('Great job! Starting next level...');
                    setTimeout(() => this.startGame(), 1000);
                }, 500);
            }
        } else {
            // 错误点击
            e.target.classList.add('error');
            this.sound.playError();
            setTimeout(() => e.target.classList.remove('error'), 300);
            
            this.isPlaying = false;
            this.setStatus(`Game Over! Final Score: ${this.score}`);
            setTimeout(() => {
                this.resetGame();
            }, 1500);
        }
    }
    
    resetGame() {
        this.isPlaying = false;
        this.score = 0;
        this.level = 1;
        this.sequence = [];
        this.playerSequence = [];
        this.updateDisplays();
        this.setStatus('Press Start to play!');
        this.startButton.disabled = false;
        
        this.tiles.forEach(tile => {
            tile.classList.remove('active', 'success', 'error');
        });
    }
    
    setStatus(message) {
        this.statusDisplay.textContent = message;
    }
}

// 当页面加载完成时启动游戏
window.onload = () => new MemoryGame();