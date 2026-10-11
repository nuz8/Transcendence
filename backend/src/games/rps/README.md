# Rock / Paper / Scissors
Game logic for RPS. Rules live in `rps.service.ts`; `move` message in `rps.gateway.ts`; connection itself in `game/games.gateway.ts`.
- Best-Of-N Match System. Rounds keep going until hitting the target value. (N always has to be an odd number)
- Users can forfeit(counts as a loss) a match by using the command: `quit`/`q`.
- Moves are `rock`, `paper`, `scissor`, or just their first letter.
- Locked to best-of-3, and always against a random move. no PvP yet.
#### Test:
The game rules needed to be tested so there is `rps.service.spec.ts`(agent generated) that helps doing that without waiting on chance.

## Playing
### Start the app, then:
Get an access token:
```
curl -sk -X POST https://localhost/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@test.com","password":"securepassword123"}'

TOKEN=$(curl -sk -X POST https://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@test.com","password":"securepassword123"}' | jq -r .access_token)
```
Connect via WebSocket through Nginx:
```
npx wscat -n -c wss://localhost/api/games/rps
```
Authenticate within 10 seconds by sending:
```json
{"event":"auth","data":{"token":"<access_token>"}}
```
Check results after playing:
```
docker compose exec db psql -U database_user -d database_name \
  -c "select session_id, value, outcome from scores;"
```

#### Notes:
- `create` first, then `join` with the id it gives you.
- Erros come back as normal messages, they don't close the connection.
- The last move returns two messages: the round result, the match result.
- Messages are JSON both ways, shaped: ` {"event": ..., "data": ...} `.

### You send:
| event | data |
|--------|------|
| `create` | nothing |
| `join` | `"<the sessionId from create>"` |
| `move` | `"rock"` |
| `quit` | nothing |

---

### You expect:
| event | data |
|----------|------|
| `created` | `{"sessionId": "..."}` |
| `joined` | `{"targetRounds", "ownScore", "opScore", "roundsPlayed"}` |
| `round` | `{"ownMove", "opMove", "outcome", "ownScore", "opScore"}` |
| `over` | `{"outcome", "ownScore", "opScore"}` |
| `error` | `{"message": "..."}` |

### On disconnect
- Disconnecting mid-match doesn't end it straight away. 
- You get a 30 seconds to reconnect.
- Connect again and `join`(same `sessionId` as before)
```
Reconnect in time → you keep playing, nothing is written down
Don't → a forfeit is saved, same as quit
You hadn't played a round yet → nothing is recorded either way
You sent quit → that's final, no window and no rejoining
```

### Choice
- Sessions themselves are in memory  only. A server restart drops any match in progress and its `sessionId` stops resolving, so `join` comes back with `no such session`. Matches this short aren't worth a table that nothing else would read. The history will read `scores`.
- So to sum up the choice I made: dropped connections are survivable(if rejoining is done in the time allocated), restarts aren't.

### Adding another game
- `games/game.gateway.ts` holds the login check, the sessions, `create`/`join`/`quit`, the reconnect window and saving the result.
- A new game extends it, supplies a `gameId` and `bestOf` and writes its own `move` handler. 

## References
- Issue: Create the rock/paper/scissors module #35
- Issue: Allow to play the rock/paper/scissors game from the web app (without frontend) #36 
- Issue: Persist game sessions #61
- ws: https://github.com/websockets/ws
