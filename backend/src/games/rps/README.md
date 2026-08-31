# Rock / Paper / Scissors
Game logic for RPS, playable from the terminal.
- Best-Of-N Match System. Rounds keep going until hitting the target value.
- N always has to be an odd number.
- Users can forfeit(counts as a loss) a match by using the command: ```quit```

# Running it
```
 cd backend (if in root)
```
Then by choice, run it choosing the N

e.q:
```
 npm run play:rps           # best of 3 - default
 npm run play:rps -- 1      # best of 1
 npm run play:rps -- 3      # best of 3
 npm run play:rps -- 15     # best of 15
 ```

Type r, p, s or their full word versions.
```
rock, paper, scissors? r
rock vs paper - you lose
```
After the round target is hit, the game end and the winner is displayed.

## References

- Issue: Create the rock/paper/scissors module #35
- Node: https://nodejs.org/api/readline.html#promises-api