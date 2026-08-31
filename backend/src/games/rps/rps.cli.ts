import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { RpsService } from './rps.service';

async function main() {

    const rps = new RpsService();
    const rl = createInterface({ input, output });

    const bestOf = Number(process.argv[2] ?? 3);
    let state = rps.createMatch(bestOf);

    console.log(`This is a best of ${bestOf}. First to ${state.targetRounds} wins`);
    console.log('Want to exit early? Type: quit');
    console.log('rock, paper, scissor - shoot:\n');

    while (!rps.gameOver(state)) {
        const answer = await rl.question('> ');
        const qg = answer.trim().toLowerCase();
        if (qg === 'q' || qg ==='quit')
        {
            state = rps.forfeit(state, 'a');
            continue ;
        }
        const move = rps.parseMove(answer);
        if (!move)
        {
            console.log('That is not a move!');
            continue;
        }

        const played = rps.playRound(state, move, rps.randomMove());
        state = played.state;

        const round = played.round;
        const outcomeRound = rps.outcomeFor('a', round);
        console.log(`${round.moveA} vs ${round.moveB} - ${outcomeRound === 'draw' ? 'draw' : `you ${outcomeRound} the round`}`)
        console.log(`score: ${state.scoreA}-${state.scoreB}`);
    }
    const outcome = rps.matchOutcome('a', state);
    const message = outcome === 'forfeit' ? 'you forfeited the game' : outcome === 'win' ? 'you won the game' : 'you lost the game';
    console.log(`${message} ${state.scoreA}-${state.scoreB}`);

    rl.close();
}

void main();
