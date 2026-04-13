# Web Simulink (Matrix Alpha)

Mobile-reactive block-diagram simulation environment.

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x+
- Supabase account (for cloud persistence)

### Environment Setup
Create a `.env.local` file in the root:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

## 🏗️ Architecture

- **Core Engine**: Deterministic fixed-step discrete-time solver.
- **Frontend**: Next.js 16 + React Flow + Tailwind CSS.
- **Persistence**: Supabase (PostgreSQL/JSONB) with LocalStorage fallback.
- **Real-time**: Socket.io for collaborative synchronization.
- **Offline**: PWA support via `next-pwa`.

## 🧪 Testing & Validation

### Unit & Integration Tests
```bash
npm run test
```
The suite covers simulation determinism, hierarchy, sensor logic, and persistence migrations.

### Production Build
```bash
npm run build
```

## 📱 Sensor Support
The environment supports browser-native sensors:
- **GPS**: Latitude/Longitude/Altitude.
- **Accelerometer**: 3-axis linear acceleration.
- **Orientation**: Device pitch/roll/yaw.

*Note: On iOS, sensor access requires a user gesture and HTTPS context.*

## 🔒 Security
- Row-Level Security (RLS) ensures users only access their own models.
- JWT-based authentication via Supabase Auth.
