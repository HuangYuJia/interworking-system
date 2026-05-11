const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store
const ADMIN_PASSWORD = 'admin123';
const classrooms = new Map();
const sessions = new Map();

// Generate a 6-digit code
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Generate a simple token
function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Create default classroom
const defaultCode = '263178';
classrooms.set(defaultCode, {
  code: defaultCode,
  name: '默认课堂',
  createdAt: new Date().toISOString(),
  messages: [],
  confusions: [],
  handRaises: [],
  students: new Set(),
  stats: { totalConfusion: 0, totalBarrage: 0 }
});

// WebSocket connections per classroom
const wsClients = new Map();

function broadcastToClassroom(classroomCode, message, excludeWs = null) {
  const clients = wsClients.get(classroomCode);
  if (!clients) return;
  const data = JSON.stringify(message);
  clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data);
    }
  });
}

// WebSocket handling
wss.on('connection', (ws, req) => {
  let currentClassroom = null;
  let currentNickname = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const { classroomCode, nickname } = msg;
        const classroom = classrooms.get(classroomCode);
        if (!classroom) {
          ws.send(JSON.stringify({ type: 'error', message: '教室码不存在' }));
          return;
        }
        currentClassroom = classroomCode;
        currentNickname = nickname || '同学';

        // Only add non-teacher users to students set
        if (currentNickname !== '教师端') {
          classroom.students.add(currentNickname);
        }

        if (!wsClients.has(classroomCode)) {
          wsClients.set(classroomCode, new Set());
        }
        wsClients.get(classroomCode).add(ws);

        ws.send(JSON.stringify({
          type: 'joined',
          classroomCode,
          nickname: currentNickname,
          stats: {
            totalConfusion: classroom.stats.totalConfusion,
            totalBarrage: classroom.stats.totalBarrage,
            studentCount: classroom.students.size
          }
        }));

        broadcastToClassroom(classroomCode, {
          type: 'student_joined',
          nickname: currentNickname,
          studentCount: classroom.students.size
        }, ws);
        break;
      }

      case 'barrage': {
        if (!currentClassroom) return;
        const classroom = classrooms.get(currentClassroom);
        if (!classroom) return;

        const message = {
          id: Date.now(),
          type: 'barrage',
          content: msg.content,
          nickname: currentNickname,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        };
        classroom.messages.push(message);
        classroom.stats.totalBarrage++;

        broadcastToClassroom(currentClassroom, {
          type: 'new_message',
          message,
          stats: {
            totalConfusion: classroom.stats.totalConfusion,
            totalBarrage: classroom.stats.totalBarrage,
            studentCount: classroom.students.size
          }
        });
        break;
      }

      case 'confusion': {
        if (!currentClassroom) return;
        const classroom = classrooms.get(currentClassroom);
        if (!classroom) return;

        const message = {
          id: Date.now(),
          type: 'confusion',
          content: msg.content || '没听懂',
          nickname: currentNickname,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        };
        classroom.messages.push(message);
        classroom.confusions.push(message);
        classroom.stats.totalConfusion++;

        broadcastToClassroom(currentClassroom, {
          type: 'new_message',
          message,
          stats: {
            totalConfusion: classroom.stats.totalConfusion,
            totalBarrage: classroom.stats.totalBarrage,
            studentCount: classroom.students.size
          }
        });
        break;
      }

      case 'hand_raise': {
        if (!currentClassroom) return;
        const classroom = classrooms.get(currentClassroom);
        if (!classroom) return;

        const handRaise = {
          id: Date.now(),
          nickname: currentNickname,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        };
        classroom.handRaises.push(handRaise);

        broadcastToClassroom(currentClassroom, {
          type: 'hand_raised',
          handRaise,
          nickname: currentNickname
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentClassroom) {
      const clients = wsClients.get(currentClassroom);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) wsClients.delete(currentClassroom);
      }
      const classroom = classrooms.get(currentClassroom);
      if (classroom) {
        broadcastToClassroom(currentClassroom, {
          type: 'student_left',
          nickname: currentNickname,
          studentCount: classroom.students.size
        });
      }
    }
  });
});

// API Routes

// Admin verification
app.post('/api/auth/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = generateToken();
    res.json({ code: 200, message: '验证成功', data: { token, redirect_url: '/dashboard.html' } });
  } else {
    res.status(401).json({ code: 401, message: '密码错误' });
  }
});

// Create classroom
app.post('/api/classroom/create', (req, res) => {
  const { name } = req.body;
  const code = generateCode();
  classrooms.set(code, {
    code,
    name: name || `课堂 ${code}`,
    createdAt: new Date().toISOString(),
    messages: [],
    confusions: [],
    handRaises: [],
    students: new Set(),
    stats: { totalConfusion: 0, totalBarrage: 0 }
  });
  res.json({ code: 200, data: { classroomCode: code, name } });
});

// Get classroom list
app.get('/api/classroom/list', (req, res) => {
  const list = [];
  classrooms.forEach((c) => {
    list.push({
      code: c.code,
      name: c.name,
      createdAt: c.createdAt,
      studentCount: c.students.size,
      stats: c.stats
    });
  });
  res.json({ code: 200, data: list });
});

// Get classroom messages
app.get('/api/classroom/:code/messages', (req, res) => {
  const classroom = classrooms.get(req.params.code);
  if (!classroom) {
    return res.status(404).json({ code: 404, message: '课堂不存在' });
  }
  res.json({
    code: 200,
    data: {
      messages: classroom.messages.slice(-50),
      stats: {
        totalConfusion: classroom.stats.totalConfusion,
        totalBarrage: classroom.stats.totalBarrage,
        studentCount: classroom.students.size
      },
      confusions: classroom.confusions,
      handRaises: classroom.handRaises
    }
  });
});

// Join classroom via HTTP (for initial connection check)
app.post('/api/classroom/join', (req, res) => {
  const { code, nickname } = req.body;
  const classroom = classrooms.get(code);
  if (!classroom) {
    return res.status(404).json({ code: 404, message: '教室码不存在' });
  }
  res.json({
    code: 200,
    message: '连接成功',
    data: { classroomCode: code, nickname: nickname || '同学' }
  });
});

// Verify speech code (same as classroom code for simplicity)
app.post('/api/speech/verify', (req, res) => {
  const { code } = req.body;
  const classroom = classrooms.get(code);
  if (!classroom) {
    return res.status(404).json({ code: 404, message: '识别码无效' });
  }
  res.json({
    code: 200,
    message: '查询成功',
    data: { classroomCode: code, redirect: `/student.html?code=${code}` }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', classrooms: classrooms.size });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  // Get local IP for mobile access
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Mobile access: http://${localIP}:${PORT}`);
  console.log(`Entry page: http://localhost:${PORT}/`);
  console.log(`Student page: http://localhost:${PORT}/student.html`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`Default classroom code: ${defaultCode}`);
});
