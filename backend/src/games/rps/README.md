# Rock / Paper / Scissors
Game logic for RPS. Rules live in 'rps.service.ts'; the CLI and the websocket are just two way in
- Best-Of-N Match System. Rounds keep going until hitting the target value. (N always has to be an odd number)
- Users can forfeit(counts as a loss) a match by using the command: `quit`/`q`.
- Moves are `rock`, `paper`, `scissor`, or just their first letter.

| Ways to play | CLI | Websocket |
|---|---|---|
| Where the match lives | in the script, for one run | on the server, tied to your connection |
| Choose N | yes, `-- 5` | no, always best-of-3 |
| Needs the app running | no | yes |
| Needs the database | no | yes |

## Through CLI
```
 cd backend (if in root)
```
Then by choice, run it choosing the N
```
 npm run play:rps           # best of 3 - default
 npm run play:rps -- 1      # best of 1
 npm run play:rps -- 3      # best of 3
 npm run play:rps -- 15     # best of 15
 ```

Type `r`, `p`, `s` or their full word. Type `q` or `quit` to forfeit.
```
rock, paper, scissors - shoot:
> r
rock vs paper - you lose the round
score: 0-1
```
After the round target is hit, the game end and the winner is displayed.

## Through Websocket
### Start the app, then:
```
npx wscat -n -c wss://localhost:3000/games/rps
```
#### Notes:
- `create` first, then `join` with the id it gives you.
- Erros come back as normal messages, they don't close the connection.
- Sessions live in memory only. Close the connection and the session is gone, no reconnecting, nothing is saved.
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
| `joined` | `{"targetRounds": 2}` |
| `round` | `{"ownMove", "opMove", "outcome", "ownScore", "opScore"}` |
| `over` | `{"outcome", "ownScore", "opScore"}` |
| `error` | `{"message": "..."}` |

## References

- Issue: Create the rock/paper/scissors module #35
- Issue: Allow to play the rock/paper/scissors game from the web app (without frontend) #36 
- Node: https://nodejs.org/api/readline.html#promises-api
- ws: https://github.com/websockets/ws
