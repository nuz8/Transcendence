import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get('self')
	@UseGuards(AuthGuard)
	async getSelf(@Req() req: any) {
		const user = await this.userService.findById(req.user.sub);

		if (!user) {
			throw new NotFoundException();
		}

		return user.toPublicData();
	}
}
