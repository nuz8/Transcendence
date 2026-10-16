import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './core/guards/auth-guard';
import { Profile } from './features/profile/profile';
import { TermsOfService } from './legal/terms-of-service/terms-of-service';
import { PrivacyPolicy } from './legal/privacy-policy/privacy-policy';
import { Home } from './features/home/home';
import { Friends } from './features/friends/friends';
import { GameContainer } from './features/games/game-container/game-container';
import { GAME_NAMES } from './features/games/game.constants';
import { ActivatedRouteSnapshot } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		component: Home,
		canActivate: [authGuard],
		title: 'Home',
	},
	{
		path: 'profile',
		component: Profile,
		canActivate: [authGuard],
		title: 'Profile',
	},
	{
		path: 'profile/:id',
		component: Profile,
		canActivate: [authGuard],
		title: 'Profile',
	},
	{
		path: 'login',
		component: Login,
		title: 'Login',
	},
	{
		path: 'register',
		component: Register,
		title: 'Register',
	},
	{
		path: 'terms',
		component: TermsOfService,
		title: 'Terms of Service',
	},
	{
		path: 'privacy',
		component: PrivacyPolicy,
		title: 'Privacy Policy',
	},
	{
		path: 'games/:gameId',
		component: GameContainer,
		canActivate: [authGuard],
		title: (route: ActivatedRouteSnapshot) =>
			GAME_NAMES[route.paramMap.get('gameId') ?? ''] ?? 'Game',
	},
	{
		path: 'friends',
		component: Friends,
		canActivate: [authGuard],
		title: 'Friends',
	}
];
