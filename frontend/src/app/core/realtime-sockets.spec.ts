import { vi } from 'vitest';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { RealtimeSockets, WEB_SOCKET_FACTORY } from './realtime-sockets';

class FakeSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING;
  readonly sent: unknown[] = [];
  readonly close = vi.fn(() => {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  });

  constructor(readonly url: string) {
    super();
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  serverAccepts(): void {
    this.readyState = WebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }
}

describe('RealtimeSockets', () => {
  let accessToken: WritableSignal<string | null>;
  let created: FakeSocket[];
  let realtime: RealtimeSockets;

  function setToken(token: string | null): void {
    accessToken.set(token);
    TestBed.tick();
  }

  function open(path = '/games/rps'): FakeSocket {
    realtime.open(path);
    return created[created.length - 1];
  }

  beforeEach(() => {
    accessToken = signal<string | null>('token-1');
    created = [];

    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { accessToken } },
        {
          provide: WEB_SOCKET_FACTORY,
          useValue: (url: string) => {
            const socket = new FakeSocket(url);
            created.push(socket);
            return socket as unknown as WebSocket;
          },
        },
      ],
    });
    realtime = TestBed.inject(RealtimeSockets);
    TestBed.tick();
  });

  it('sends the current token once the socket is open', () => {
    const socket = open('/games/rps');
    expect(socket.url).toContain('/api/games/rps');
    expect(socket.sent).toEqual([]);

    socket.serverAccepts();

    expect(socket.sent).toEqual([{ event: 'auth', data: { token: 'token-1' } }]);
  });

  it('resends a new token to open sockets only', () => {
    const openSocket = open();
    const connectingSocket = open('/chat');
    openSocket.serverAccepts();

    setToken('token-2');

    expect(openSocket.sent).toEqual([
      { event: 'auth', data: { token: 'token-1' } },
      { event: 'auth', data: { token: 'token-2' } },
    ]);
    expect(connectingSocket.sent).toEqual([]);
  });

  it('closes every socket on logout', () => {
    const first = open();
    const second = open('/chat');
    first.serverAccepts();

    setToken(null);

    expect(first.close).toHaveBeenCalled();
    expect(second.close).toHaveBeenCalled();
  });

  it('forgets a socket once it is closed', () => {
    const socket = open();
    socket.serverAccepts();
    socket.close();

    setToken(null);

    expect(socket.close).toHaveBeenCalledTimes(1);
  });
});
