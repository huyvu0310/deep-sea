import { dbEnabled } from './db';
import { Room } from './room';
import { deleteRoom, knownCodes, loadRoom } from './store';

/** Ambiguous glyphs (0/O, 1/I) are left out so codes survive being read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

export class RoomRegistry {
  private rooms = new Map<string, Room>();

  /**
   * Open a new table. Saved tables count as taken even when no one is
   * connected to them, so a fresh code can never land on a game in progress
   * that is currently only in the database.
   */
  async create(): Promise<Room> {
    const taken = await knownCodes();
    let code = this.newCode();
    while (this.rooms.has(code) || taken.has(code)) code = this.newCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  /** A table already in memory. */
  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /**
   * A table by code, read back from storage if this process has not seen it —
   * which is how a game survives a restart, a redeploy, or the host's instance
   * going to sleep.
   */
  async find(code: string): Promise<Room | undefined> {
    const key = code.trim().toUpperCase();
    const live = this.rooms.get(key);
    if (live) return live;

    const saved = await loadRoom(key);
    if (!saved) return undefined;

    const room = Room.restore(saved);
    this.rooms.set(key, room);
    return room;
  }

  /**
   * Forget tables nobody is sitting at, so codes stay recyclable.
   *
   * A table with nobody connected is only let go when it has been written
   * down — without a database, memory is the only copy of a game in progress,
   * and everyone being momentarily disconnected is not a reason to lose it.
   */
  prune(): void {
    for (const [code, room] of this.rooms) {
      if (room.isEmpty || (dbEnabled && room.idle)) this.rooms.delete(code);
    }
  }

  /** Close a table for good, in memory and in storage. */
  async close(code: string): Promise<void> {
    this.rooms.delete(code);
    await deleteRoom(code);
  }

  private newCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }
}
