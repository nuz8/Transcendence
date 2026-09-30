import { achievements } from "../db/schema";
import { INITIAL_ACHIEVEMENTS } from "./achievement-catalogue";
import type { DB } from "../db/client";

export async function seedAchievements(db: DB): Promise<void> {
  for (const item of INITIAL_ACHIEVEMENTS) {
    await db
      .insert(achievements)
      .values(item)
      .onConflictDoUpdate({
        target: achievements.id,
        set: {
          title: item.title,
          description: item.description,
          badgeUrl: item.badgeUrl,
          targetWins: item.targetWins,
        },
      });
  }
}