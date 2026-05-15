# KRONOS ARENA — PRD

## Original Problem
Multiplayer online 2D top-down survival infection game "KRONOS ARENA" — dark neon urban skatepark, infection spreads by touch, last survivor wins. User chose **single-player with AI bots** (no real multiplayer).

## Architecture
- Backend: FastAPI + MongoDB (leaderboard + round results)
- Frontend: React + HTML5 Canvas game loop, Web Audio API procedural grunge/metal music
- No socket.io (single-player with AI bots per user choice)

## Tech Stack
- FastAPI / motor (async MongoDB)
- React 19 + Canvas2D
- Web Audio API for procedural music + SFX
- Tailwind + custom neon CSS

## Implemented (Feb 2026)
- Lobby screen with callsign input, bot count slider, leaderboard ribbon
- Game screen with full HUD: timer, survivor/infected counts, mini-map, legend, controls hint, objective banner, mute/exit buttons
- Canvas-based arena (1600x960 world, scaled) with grid floor, neon walls, biohazard center
- KRONOS sprites (survivor + infected) with green/red radial glows, motion trails, infection pulse
- WASD smooth-accel movement, AABB wall collisions
- AI bots: survivors flee, infected chase, with wander noise and wall avoidance
- Infection-by-contact with 0.6s grace period, particles + flash
- 90s round timer, win/lose conditions, end overlay with stats
- Procedural grunge/metal music loop (bass riff + kick/snare/hat) + SFX (infection, click, round start, win/lose)
- Backend: /api/rounds POST + /api/leaderboard GET aggregation

## P1 Backlog
- Real multiplayer over Socket.IO
- More maps / map rotation
- Power-ups (speed boost, decoy, EMP)
- Mobile touch controls (virtual joystick)
- Profile/auth so leaderboards are anti-spoof
