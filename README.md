# PPT 实时反馈系统 (Interworking System)

一个基于 WebSocket 的课堂实时互动反馈系统，支持学生端连接教室、发送弹幕、举手提问，教师端可通过后台管理面板实时查看学生反馈数据。

## 功能特性

- **学生端**
  - 通过教室码连接课堂
  - 发送弹幕消息
  - 举手提问（支持附加困惑描述）
  - 实时同步课堂状态

- **教师端（后台管理）**
  - 创建/管理多个课堂
  - 实时查看学生消息和举手
  - 查看统计数据（困惑次数、弹幕数量、在线人数）
  - 生成二维码供学生扫码加入

- **系统特性**
  - 基于 WebSocket 实时通信，低延迟
  - 支持手机端扫码访问
  - 响应式设计，适配多种屏幕尺寸
  - 纯内存数据存储，无需数据库

## 技术栈

| 技术 | 说明 |
|------|------|
| Node.js | 后端运行环境 |
| Express | Web 框架，提供静态文件服务和 REST API |
| ws | WebSocket 库，实现实时双向通信 |
| HTML/CSS/JS | 前端页面，无框架依赖 |
| QRCode.js | 前端二维码生成 |

## 项目结构

```
├── server.js              # 后端服务入口
├── package.json           # 项目依赖配置
├── .gitignore             # Git 忽略配置
└── public/                # 前端静态文件
    ├── index.html         # 首页（入口导航）
    ├── student.html       # 学生端页面
    ├── dashboard.html     # 教师端后台管理页面
    ├── admin-login.html   # 管理员登录页面
    ├── join.html          # 演讲识别码加入页面
    ├── css/
    │   └── style.css      # 全局样式
    └── js/
        └── qrcode.min.js  # 二维码生成库
```

## 快速开始

### 环境要求

- Node.js >= 14

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/HuangYuJia/interworking-system.git
cd interworking-system

# 安装依赖
npm install

# 启动服务
npm start
```

启动后控制台会输出：

```
Server running at http://localhost:3000
Mobile access: http://<你的内网IP>:3000
Default classroom code: 263178
```

### 访问地址

| 页面 | 地址 |
|------|------|
| 首页 | `http://localhost:3000/` |
| 学生端 | `http://localhost:3000/student.html` |
| 教师后台 | `http://localhost:3000/dashboard.html` |
| 管理登录 | `http://localhost:3000/admin-login.html` |

### 默认账号

- 管理员密码：`admin123`
- 默认教室码：`263178`

## 使用流程

1. **教师端**：访问后台管理页面，创建课堂获取教室码
2. **学生端**：通过教室码或扫码加入课堂
3. **互动**：学生可以发送弹幕、举手提问
4. **教师端**：实时查看学生反馈，统计数据自动更新

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/admin/verify` | 管理员密码验证 |
| POST | `/api/classroom/create` | 创建课堂 |
| GET | `/api/classroom/list` | 获取课堂列表 |
| GET | `/api/classroom/:code/messages` | 获取课堂消息 |
| POST | `/api/classroom/join` | 加入课堂 |
| POST | `/api/speech/verify` | 验证演讲识别码 |
| GET | `/api/health` | 健康检查 |

### WebSocket 消息类型

| type | 方向 | 说明 |
|------|------|------|
| `join` | 客户端 → 服务端 | 加入课堂 |
| `joined` | 服务端 → 客户端 | 加入成功确认 |
| `barrage` | 客户端 → 服务端 | 发送弹幕 |
| `confusion` | 客户端 → 服务端 | 发送困惑 |
| `hand_raise` | 客户端 → 服务端 | 举手 |
| `new_message` | 服务端 → 客户端 | 新消息广播 |
| `hand_raised` | 服务端 → 客户端 | 举手广播 |
| `student_joined` | 服务端 → 客户端 | 学生加入通知 |
| `student_left` | 服务端 → 客户端 | 学生离开通知 |

## 局域网部署

如需手机访问，确保手机和服务器在同一局域网：

1. 查看服务器内网 IP（启动时控制台会显示）
2. 如手机无法访问，检查 Windows 防火墙是否放行 3000 端口

```powershell
# 管理员权限 PowerShell 执行
netsh advfirewall firewall add rule name="Node Server 3000" dir=in action=allow protocol=TCP localport=3000
```

## 注意事项

- 当前使用内存存储数据，服务重启后数据会丢失
- 默认端口为 3000，可通过环境变量 `PORT` 修改
- 生产环境建议配合 nginx 反向代理使用

## License

MIT
