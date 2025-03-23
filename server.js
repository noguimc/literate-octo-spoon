const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const gameState = {
  players: {},
  bullets: [],
  obstacles: []
};

// 生成固定障碍物
function generateObstacles() {
  return [
    { x: 400, y: 300, w: 400, h: 40 },
    { x: 500, y: 200, w: 40, h: 400 },
    { x: 100, y: 100, w: 120, h: 80 },
    { x: 50, y: 600, w: 200, h: 40 },
    { x: 950, y: 100, w: 120, h: 80 },
    { x: 900, y: 600, w: 200, h: 40 },
    { x: 400, y: 50, w: 120, h: 40 },
    { x: 400, y: 710, w: 120, h: 40 },
    { x: 200, y: 400, w: 80, h: 80 },
    { x: 920, y: 400, w: 80, h: 80 }
  ];
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // 初始化新玩家
  const playerId = socket.id;
  gameState.players[playerId] = {
    x: Math.random() * 1000 + 100,
    y: 700,
    direction: 'up',
    color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
    lastFire: 0
  };

  // 发送初始状态
  socket.emit('init', {
    players: gameState.players,
    bullets: gameState.bullets,
    obstacles: generateObstacles()
  });

  // 广播新玩家加入
  socket.broadcast.emit('playerJoined', gameState.players[playerId]);

  // 处理玩家输入
  socket.on('input', (input) => {
    if (!gameState.players[playerId]) return;
    
    const player = gameState.players[playerId];
    const speed = 5;
    
    // 移动处理
    let newX = player.x;
    let newY = player.y;
    
    if (input.up) newY -= speed;
    if (input.down) newY += speed;
    if (input.left) newX -= speed;
    if (input.right) newX += speed;
    
    // 碰撞检测（简化版）
    const tankSize = 50;
    if (newX >= 0 && newX <= 1200 - tankSize) player.x = newX;
    if (newY >= 0 && newY <= 800 - tankSize) player.y = newY;
    
    // 方向更新
    if (input.direction) player.direction = input.direction;
    
    // 射击处理
    if (input.fire && Date.now() - player.lastFire > 500) {
      const bullet = createBullet(player);
      gameState.bullets.push(bullet);
      player.lastFire = Date.now();
      io.emit('bulletCreated', bullet);
    }
  });

  // 断开连接处理
  socket.on('disconnect', () => {
    delete gameState.players[playerId];
    io.emit('playerLeft', playerId);
  });
});

function createBullet(player) {
  const angle = {
    up: 0, left: -90, down: 180, right: 90,
    upLeft: -45, upRight: 45, downLeft: -135, downRight: 135
  }[player.direction] * Math.PI / 180;

  return {
    id: Date.now().toString(),
    x: player.x + 25 + Math.sin(angle) * 35,
    y: player.y + 25 - Math.cos(angle) * 35,
    speedX: Math.sin(angle) * 8,
    speedY: -Math.cos(angle) * 8,
    owner: player.id,
    timestamp: Date.now()
  };
}

// 游戏循环
setInterval(() => {
  // 更新子弹位置
  gameState.bullets = gameState.bullets.filter(bullet => {
    bullet.x += bullet.speedX;
    bullet.y += bullet.speedY;
    
    // 边界检测
    return bullet.x >= 0 && bullet.x <= 1200 &&
           bullet.y >= 0 && bullet.y <= 800 &&
           Date.now() - bullet.timestamp < 2500;
  });
  
  // 广播游戏状态
  io.emit('update', {
    players: gameState.players,
    bullets: gameState.bullets
  });
}, 1000 / 60);

server.listen(3000, () => {
  console.log('listening on *:3000');
});