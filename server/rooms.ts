import { Room } from './room';

/** Ambiguous glyphs (0/O, 1/I) are left out so codes survive being read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

export class RoomRegistry {
  private rooms = new Map<string, Room>();

  create(): Room {
    let code = this.newCode();
    while (this.rooms.has(code)) code = this.newCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /** Forget tables nobody is sitting at, so codes stay recyclable. */
  prune(): void {
    for (const [code, room] of this.rooms) {
      if (room.isEmpty) this.rooms.delete(code);
    }
  }

  private newCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }
}
