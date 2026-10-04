# LAMP: The Server Quest

A story-driven 3D engineering adventure for the LAMP stack (Linux, Apache, MySQL, PHP). You are a new engineer: register, explore your house, find the Magic Box, visit the Introduction Hub, then take real engineering tickets from **ByteForge Solutions** and **NexaCore Technologies**. You upload your solutions, get them validated automatically, document the procedure, and work your way to harder companies. Progress is saved in Supabase.

The six training stations open configurable study pages in-game. The simulated terminal and optional AI tutor are also available.

> **Server Quest technical guide:** [docs/SERVER_QUEST.md](docs/SERVER_QUEST.md) covers the game flow, routes, env vars, database and RLS, validation, scoring, extending companies/missions/characters, local Supabase and deployment.

## 🎯 Overview

LAMP Quest is an immersive learning experience where users explore a 3D campus, study at six training stations, complete engineering missions, and earn points while mastering the fundamentals of web server architecture.

## ✨ Features

- **3D Interactive Campus**: Explore the valley and enter any training station
- **Training Pages**: Open configurable external references in a game-style popup and earn +25 points for each page studied
- **Leaderboard**: Compare total quest points and training XP with other players
- **Simulated Terminal**: Safe, controlled terminal simulation for practicing commands
- **XP & Leveling System**: Earn experience points and unlock new content
- **AI Tutor**: Context-aware AI tutor for hints and explanations (optional)
- **Complete LAMP Coverage**: Linux, Apache, PHP, MySQL, Integration, and AWS deployment
- **Final Challenge**: Comprehensive deployment simulation to test all skills

## Adding your station links

Paste each HTTPS page URL into its `url` field in `src/content/quest/station-sites.ts`. See [Training station pages](docs/SERVER_QUEST.md#training-station-pages) for framing requirements and study rewards.

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **3D Graphics**: Three.js, React Three Fiber, @react-three/drei
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Animations**: Built-in React hooks and CSS transitions

## 📋 Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sdtt-lamp-quest
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Configure Supabase** (required for the quest — see [docs/SERVER_QUEST.md](docs/SERVER_QUEST.md#9-local-development))
   ```bash
   npx supabase start && npx supabase status
   cp .env.example .env.local   # fill in the Supabase URL, anon key and service-role key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Unit tests (validation engine, procedure review, progression)
npm run test
```

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/tutor/         # AI tutor API route
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── play/              # 3D game page
├── components/
│   ├── GameShell.tsx      # Main game container
│   ├── hud/               # UI components
│   │   ├── HudChrome.tsx  # XP bar and station map strip
│   │   └── Leaderboard.tsx
│   ├── quest/
│   │   └── SitePopup.tsx  # Training page popup
│   └── world/             # 3D world components
│       ├── Campus.tsx     # Main 3D scene
│       ├── CameraRig.tsx  # Camera controller
│       ├── Player.tsx     # Player character
│       ├── StationPad.tsx # Interactive stations
│       └── WorldCanvas.tsx
├── content/
│   ├── lessons/           # Educational content
│   │   ├── linux.ts
│   │   ├── apache.ts
│   │   ├── php.ts
│   │   ├── mysql.ts
│   │   ├── lamp.ts
│   │   └── aws.ts
│   ├── missions/          # Mission definitions
│   │   ├── linux.ts
│   │   ├── apache.ts
│   │   ├── php.ts
│   │   ├── mysql.ts
│   │   ├── lamp.ts
│   │   └── aws.ts
│   └── stations.ts        # Station configurations
├── features/
│   ├── terminal/          # Terminal simulation
│   │   └── TerminalPanel.tsx
│   └── tutor/             # AI tutor
│       └── TutorPanel.tsx
├── lib/
│   ├── missions/          # Mission logic
│   │   └── engine.ts
│   ├── persist/           # Progress persistence
│   │   └── progress.ts
│   ├── progress/          # Progress & unlocks
│   │   └── unlocks.ts
│   ├── terminal/          # Terminal simulator
│   │   └── simulator.ts
│   └── tutor/             # Tutor implementations
│       ├── http-tutor.ts
│       └── mock-tutor.ts
├── stores/
│   └── game-store.ts      # Zustand global state
├── types/
│   └── game.ts            # TypeScript types
└── constants/
    └── stations.ts        # Station order, XP values
```

## 🎮 How the Simulated Terminal Works

The terminal is a **safe simulation** - it does NOT execute real commands on your system. Instead:

1. **Command Parsing**: Commands are parsed and matched against known patterns
2. **State Management**: The simulator maintains internal state (files, services, packages)
3. **Validation**: Commands are validated against expected patterns for missions
4. **Feedback**: Simulated output is generated based on the command and current state

**Available Bash Commands**:
- `pwd`, `ls`, `whoami` - Basic navigation
- `mkdir`, `cd`, `touch`, `cat`, `cp`, `mv`, `rm` - File operations
- `chmod` - Permissions (simulated)
- `ps`, `top` - Process viewing
- `systemctl` - Service management
- `apt` - Package management
- `ssh` - Remote connection (simulated)

**Shell Flavors**:
- `bash` - General Linux commands
- `apache` - Apache-specific commands
- `php` - PHP CLI simulation
- `mysql` - MySQL SQL simulation
- `lamp` - Stack-level commands

## 📊 Progression System

### XP & Levels
- Training XP and quest score are stored in Supabase.

### Training stations
Linux, Apache, PHP, MySQL, Introduction Hub and AWS are all available throughout the valley. Press E, use the map strip, or visit the Introduction Hub arch to open a station page. Studying a linked page for 20 seconds awards +25 points once.

## 🤖 AI Tutor Configuration

The AI tutor uses OpenAI's API (optional). To enable:

1. Create a `.env.local` file:
   ```
   OPENAI_API_KEY=your-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```

2. The tutor will automatically use the API if configured, falling back to a mock tutor otherwise.

**Note**: Never commit `.env.local` to version control.

## 🎨 Adding New 3D Models

The current implementation uses placeholder geometry. To add real 3D models:

1. Place GLB/GLTF files in `public/models/`
2. Update `StationPad.tsx` to load models:
   ```typescript
   import { useGLTF } from "@react-three/drei";
   
   const { scene } = useGLTF("/models/station.glb");
   <primitive object={scene} />
   ```

3. Ensure models are optimized for web (compressed textures, reasonable polygon count)

## 🧪 Testing

### Manual Testing Checklist
- [ ] Landing page loads correctly
- [ ] Progress indicator shows existing progress
- [ ] "Start Quest" button navigates to 3D world
- [ ] 3D world loads without errors
- [ ] WASD movement works
- [ ] Mouse camera control works (click to lock pointer)
- [ ] Collision detection prevents walking through stations
- [ ] "Press E to enter" prompt appears near all stations and the Introduction Hub
- [ ] Station pages show the configured webpage or an empty-link placeholder
- [ ] Study timer, +25 points and leaderboard update correctly
- [ ] Terminal accepts commands and shows output
- [ ] Mission validation works
- [ ] XP updates correctly
- [ ] Progress persists after refresh
- [ ] AI tutor responds (if configured)
- [ ] Final challenge completion screen shows
- [ ] No console errors in browser

### Build Verification
```bash
npm run build
npm run lint
npx tsc --noEmit
```

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Deploy automatically

### Other Platforms
```bash
npm run build
npm start
```

The build output is in `.next/` and can be deployed to any Node.js hosting platform.

## 🔒 Security Considerations

- **No Real Command Execution**: Terminal is purely simulated
- **No API Key Exposure**: AI API keys are server-side only
- **Server-validated progress**: Points, milestones and achievements are written through authenticated API routes
- **Leaderboard reads**: Authenticated players can read the public leaderboard; only server triggers maintain rows

## 📝 License

This project is educational software. Feel free to use and modify for learning purposes.

## 🤝 Contributing

This is an educational project. Suggestions and improvements are welcome!

## 📚 Learning Resources

- [Linux Documentation](https://www.linux.org/docs/)
- [Apache HTTP Server Documentation](https://httpd.apache.org/docs/)
- [PHP Manual](https://www.php.net/docs.php)
- [MySQL Reference Manual](https://dev.mysql.com/doc/)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)

## 🎓 Acknowledgments

Built with modern web technologies to make learning server architecture accessible and engaging.
# LAMP-ARCH
