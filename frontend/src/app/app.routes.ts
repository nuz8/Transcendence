import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { authGuard } from './core/guards/auth-guard';
import { Profile } from './features/profile/profile';
import { TermsOfService } from './legal/terms-of-service/terms-of-service';
import { PrivacyPolicy } from './legal/privacy-policy/privacy-policy';
import { Rps } from './features/games/rps/rps';
import { Ttt } from './features/games/ttt/ttt';
import { Home } from './features/home/home';

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
		path: 'games/1f3b8ae9-fb12-4deb-9ffc-7c498b3e446e',
		component: Rps,
		canActivate: [authGuard],
		title: 'Rock Paper Scissors',
	},
	{
		path: 'games/7c2d9e41-5a3b-4f68-9b1e-2d8a6c4f0e53',
		component: Ttt,
		canActivate: [authGuard],
		title: 'Tic-Tac-Toe',
	}
];
