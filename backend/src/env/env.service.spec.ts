import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EnvService } from './env.service';

describe('EnvService', () => {
  let service: EnvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [EnvService],
    }).compile();

    service = module.get<EnvService>(EnvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
