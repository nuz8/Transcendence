import { Type } from "@angular/core";
import { Rps } from "./rps/rps";
import { Ttt } from "./ttt/ttt";

export const RPS_GAME_ID = '1f3b8ae9-fb12-4deb-9ffc-7c498b3e446e';
export const RPS_GAME_NAME = 'Rock Paper Scissors';
export const TTT_GAME_ID = '7c2d9e41-5a3b-4f68-9b1e-2d8a6c4f0e53';
export const TTT_GAME_NAME = 'Tic Tac Toe';

// Maps a game id to the backend gateway's websocket path (see backend/src/games/*/*.gateway.ts).
export const GAME_SOCKET_PATHS: Record<string, string> = {
  [RPS_GAME_ID]: '/games/rps',
  [TTT_GAME_ID]: '/games/tictactoe',
};

export const GAME_NAMES: Record<string, string> = {
  [RPS_GAME_ID]: RPS_GAME_NAME,
  [TTT_GAME_ID]: TTT_GAME_NAME,
};

export const GAME_COMPONENTS: Record<string, Type<unknown>> = {
  [RPS_GAME_ID]: Rps,
  [TTT_GAME_ID]: Ttt,
};

export const GAME_SUPPORTS_POWER_UPS: Record<string, boolean> = {
  [RPS_GAME_ID]: true,
  [TTT_GAME_ID]: false,
};
