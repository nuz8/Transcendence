# Tic-Tac-Toe

The Tic-Tac-Toe game logic is in `tictactoe.service.ts`; its WebSocket events are handled by `tictactoe.gateway.ts`. It uses the shared match, score, authentication, reconnect, and matchmaking services.

## Rules

- Tic-tac-toe is PvP-only and starts through the matchmaking queue. The `create` event is rejected.
- The board is a flat array of 9 cells in row-major order. Cell indices are `0` through `8`, so the top row is `0, 1, 2`, the middle row is `3, 4, 5`, and the bottom row is `6, 7, 8`.
- Seat `a` uses `X`; seat `b` uses `O`.
- The first player to start is chosen randomly for the match. The starting player alternates each round.
- Each turn has a 30-second time limit, configured by `TTT_TURN_TIME_LIMIT_MS` in `tictactoe.constants.ts`.
- A win or draw ends the current round. The match follows the player's saved match settings, or the shared defaults if no settings have been saved. Power-ups are disabled for Tic-Tac-Toe.

## Start playing

Start the application, then register and log in to obtain an access token:

```sh
curl -sk -X POST https://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@test.com","password":"securepassword123"}'

TOKEN=$(curl -sk -X POST https://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@test.com","password":"securepassword123"}' | jq -r .access_token)
```

Connect to the backend's exposed port:

```sh
npx wscat -n -c wss://localhost:3000/games/tictactoe
```

The `-n` option allows `wscat` to connect when the local TLS certificate is self-signed. If `APP_PORT` is set to a value other than `3000`, use that host port instead.

The current nginx configuration does not proxy `/games/...` WebSocket connections to the backend. Connect directly to the backend port as shown above; connecting through the nginx URL will not reach this gateway until a WebSocket proxy route is configured.

After connecting, authenticate by sending this JSON message (replace the token value):

```json
{"event":"auth","data":{"token":"<access token>"}}
```

Wait for the `authenticated` response before sending game events. Open a second connection using a different user account to play the other seat.

## WebSocket messages

Every message is a JSON object with the shape `{"event":"...","data":...}`. For events without a payload, omit `data`.

### Client to server

| Event | Data | Purpose |
|---|---|---|
| `auth` | `{"token":"<access token>"}` | Authenticate the WebSocket connection. |
| `queue` | None | Join matchmaking. The second eligible player starts the match. |
| `leave-queue` | None | Leave matchmaking while waiting. |
| `move` | A number or digit string from `0` to `8` | Place the player's mark in that cell. |
| `join` | `"<sessionId>"` | Reconnect to your existing session after disconnecting. |
| `quit` | None | Forfeit the match. |
| `create` | None | Rejected because Tic-Tac-Toe is PvP-only. |

Example move:

```json
{"event":"move","data":4}
```

### Server to client

| Event | Data fields | Purpose |
|---|---|---|
| `authenticated` | `userId` | Authentication succeeded. |
| `waiting` | `message` | You are waiting for an opponent. |
| `matched` | `sessionId`, `mode`, `target`, `powerUps`, `roundTimeLeft`, `symbol`, `board`, `yourTurn`, `turnTimeMs` | A match was created; includes your initial board and seat details. |
| `joined` | Match settings, scores, round state, `roundTimeLeft`, `symbol`, `board`, `yourTurn`, `turnTimeMs` | Session state sent to a reconnecting player. |
| `moved` | `board`, `lastCell`, `yourTurn`, `roundTimeLimit` | A move was accepted and the board updated. In the current implementation, `roundTimeLimit` carries the remaining time in milliseconds. |
| `round` | `board`, `outcome`, `yourTurn`, `roundsPlayed`, `ownScore`, `opScore`, `roundTimeLeft` | A round ended; `outcome` is from the receiving player's perspective. |
| `opponent_disconnected` | `reconnectTime` | Your opponent disconnected; the value is milliseconds. |
| `opponent_reconnected` | `roundTimeLeft` | Your opponent reconnected; the value is milliseconds. |
| `over` | `outcome`, `ownScore`, `opScore` | The match ended. |
| `error` | `message` | The request was rejected; the connection remains open. |
| `cancelled` | `message` | The session was cancelled, for example when nobody moved before the first round. |

The `board` field uses client-facing marks: `"X"`, `"O"`, or `null` for an empty cell. `yourTurn` is a boolean indicating whether it is your move.

## Reconnects and persistence

- If a player disconnects, the round clock pauses while the player has up to 30 seconds to reconnect.
- Reconnect to `/games/tictactoe`, authenticate again, then send `join` with the original `sessionId`. The `joined` message includes the current board, turn, and remaining time.
- If the reconnect window expires, the disconnected player forfeits after at least one round has been played. A disconnect before the first round cancels the session without recording a match result.
- Active sessions are held in memory. A server restart discards them. Completed match scores are recorded through the shared score service.
