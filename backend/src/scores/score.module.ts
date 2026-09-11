import { Module } from '@nestjs/common';
import { ScoreRepository } from './score.repository';

@Module({ providers: [ScoreRepository], exports: [ScoreRepository] })
export class ScoreModule {}