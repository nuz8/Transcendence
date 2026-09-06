import { Module, OnModuleInit } from '@nestjs/common';
import { db } from '../../db/client';
import { games } from '../../db/schema';
import { RPS_GAME_ID, RPS_GAME_NAME } from './rps.constants';
import { RpsGateway } from './rps.gateway';
import { RpsService } from './rps.service';

@Module({ providers: [RpsService, RpsGateway]})
export class RpsModule implements OnModuleInit {
    async onModuleInit(): Promise<void> {
        await db.insert(games).values({ id: RPS_GAME_ID, name: RPS_GAME_NAME }).onConflictDoNothing();
    }
}
