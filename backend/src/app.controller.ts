import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiAppController, ApiGetRoot } from './app-api.decorators';

@ApiAppController()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiGetRoot()
  getHello(): string {
    return this.appService.getHello();
  }
}
