import { TicTacToeService } from '../tictactoe.service';
import { WIN_LINES } from '../tictactoe.constants';
import type { Board } from '../tictactoe.types';

describe('TicTacToeService', () => {
  const ttt = new TicTacToeService();

  // Builds a board with the given cells owned by one player.
  const boardWith = (player: 'a' | 'b', cells: number[]): Board =>
    cells.reduce((b, c) => ttt.place(b, c, player), ttt.emptyBoard());

  it('detects every winning line', () => {
    for (const line of WIN_LINES)
      expect(ttt.winnerOf(boardWith('a', [...line]))).toBe('a');
  });

  it('reports no winner on an unfinished board and detects a full-board draw', () => {
    expect(ttt.winnerOf(ttt.emptyBoard())).toBeNull();
    const draw: Board = ['a', 'b', 'a', 'a', 'b', 'b', 'b', 'a', 'a'];
    expect(ttt.winnerOf(draw)).toBeNull();
    expect(ttt.isFull(draw)).toBe(true);
  });

  it('places immutably and reports occupied cells', () => {
    const empty = ttt.emptyBoard();
    const next = ttt.place(empty, 4, 'b');
    expect(empty[4]).toBeNull();
    expect(next[4]).toBe('b');
    expect(ttt.isFree(next, 4)).toBe(false);
  });

  it('parses numbers and digit strings and rejects everything else', () => {
    expect(ttt.parseCell(0)).toBe(0);
    expect(ttt.parseCell(' 8 ')).toBe(8);
    expect(ttt.parseCell(9)).toBeNull();
    expect(ttt.parseCell(-1)).toBeNull();
    expect(ttt.parseCell(1.5)).toBeNull();
    expect(ttt.parseCell('x')).toBeNull();
    expect(ttt.parseCell(undefined)).toBeNull();
  });

  it('alternates the starter each round from the first starter', () => {
    expect(ttt.startingPlayer('a', 0)).toBe('a');
    expect(ttt.startingPlayer('a', 1)).toBe('b');
    expect(ttt.startingPlayer('b', 0)).toBe('b');
    expect(ttt.startingPlayer('b', 3)).toBe('a');
  });

  it('picks only free cells, and null on a full board', () => {
    expect(ttt.pickRandomFreeCell(['a', 'b', 'a', 'a', 'b', 'b', 'b', null, 'a'])).toBe(7);
    expect(ttt.pickRandomFreeCell(['a', 'b', 'a', 'a', 'b', 'b', 'b', 'a', 'a'])).toBeNull();
  });

  it('reports outcomes from each seat perspective', () => {
    expect(ttt.outcomeFor('a', 'a')).toBe('win');
    expect(ttt.outcomeFor('b', 'a')).toBe('lose');
    expect(ttt.outcomeFor('a', null)).toBe('draw');
  });

  it('converts seats to client marks', () => {
    expect(ttt.transformToMarks(['a', 'b', null, null, null, null, null, null, null]).slice(0, 3)).toEqual(['X', 'O', null]);
  });
});