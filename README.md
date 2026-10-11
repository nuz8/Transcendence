This project has been created as part of the 42 curriculum by sbruma, maba, pamatya, and mkijewsk.

# Transcendence

## Description

An arcade video game platform. 
<!-- This description is a generic one. We'll update it when it's more defined. -->

## Running the Application

The entire stack runs via Docker Compose behind an Nginx reverse proxy providing HTTPS everywhere.

```bash
# Generate certificates (auto-detects local IP/hostname SANs) and start containers
make up
```

- **HTTPS (Port 443):** Single public entry point (`https://localhost` or `https://<LAN_IP>`).
- **HTTP (Port 80):** Automatically redirects all traffic to HTTPS (301 Moved Permanently).
- **Backend API & WebSockets:** Proxied under `/api/` (`https://<host>/api/...` and `wss://<host>/api/...`).
- **Internal Ports:** The frontend container (8080) and backend container (3000) are not exposed directly on the host, ensuring all incoming traffic is encrypted through Nginx.

## Accessing from Another Device on the LAN

During evaluations or multi-device demos:

1. **Find your local IP address:**
   ```bash
   ipconfig getifaddr en0
   ```
   *(e.g., `192.168.0.2`)*

2. **Regenerate certificates (if moving to a new Wi-Fi network):**
   ```bash
   make certs-clean
   make up
   ```
   The [Makefile](Makefile) automatically includes your LAN IP and Bonjour hostname (`<LocalHostName>.local`) in the certificate's Subject Alternative Names (SAN). You can also explicitly specify an IP:
   ```bash
   make up HOST_IP=192.168.0.2
   ```

3. **Open the browser on the second device:**
   - Connect the second device to the same Wi-Fi network.
   - Navigate to `https://<HOST_IP>` (e.g. `https://192.168.0.2`).
   - Accept the self-signed certificate warning.
   - Register/log in. The frontend dynamically sends API requests and opens WebSockets to the host you loaded the page from, and session cookies persist across reloads.

## Testing WebSockets via Frontend DevTools

1. Log in at `https://<host>/`.
2. Click the **"Connect RPS Socket"** button to establish a connection to `wss://<host>/api/games/rps`.
3. Open Developer Tools (`F12`) $\rightarrow$ **Console**. You can interact directly with the game gateway using the built-in helper:
   ```javascript
   // Create a match vs bot
   sendRps('create');

   // Send a move ('rock', 'paper', or 'scissors')
   sendRps('move', 'rock');

   // Forfeit / surrender
   sendRps('quit');
   ```
4. Check the **Network** $\rightarrow$ **WS** tab: verify that the connection connects to `wss://<host>/api/games/rps` and remains open through 60s idle rounds.

### Playing PvP Across Two Devices on the Same Network

To demo multiplayer gameplay across two computers:

1. **Player 1 (Host Mac):**
   - Navigate to `https://localhost` (or `https://<HOST_IP>`).
   - Log in with Account 1 (e.g. `alice`).
   - Click **"Connect RPS Socket"**.
   - Open DevTools Console (`F12`) and join the matchmaking queue:
     ```javascript
     sendRps('queue');
     ```
     *(Console displays: `waiting for an opponent`)*

2. **Player 2 (Second Computer / Phone):**
   - Connect to the same Wi-Fi.
   - Navigate to `https://<HOST_IP>`.
   - Log in with Account 2 (e.g. `bob`).
   - Click **"Connect RPS Socket"**.
   - Open DevTools Console (`F12`) and join the queue:
     ```javascript
     sendRps('queue');
     ```

3. **Match in Progress:**
   - Both consoles instantly receive a `matched` event with a shared `sessionId` and match settings.
   - Both players submit a move within the 60s round limit:
     - Player 1: `sendRps('move', 'rock');`
     - Player 2: `sendRps('move', 'scissors');`
   - As soon as both moves are in, both consoles receive the `round` event with the outcome and updated scores.
   - Play continues until a player wins the match (best-of-3 by default), ending with an `over` event and persisting the result to PostgreSQL.

## Instructions

> In backend directory

### Project setup

```bash
$ npm install
```

### Compile and run the project

```bash
# development
$ npm run dev:cert
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Technical choices

- Framework: NestJS is a framework for building efficient, scalable Node.js server-side applications. [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
