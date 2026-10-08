import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Hello } from './features/dummies/hello/hello';
import { authGuard } from './core/guards/auth-guard';
import { Profile } from './features/profile/profile';
import { TermsOfService } from './legal/terms-of-service/terms-of-service';
import { PrivacyPolicy } from './legal/privacy-policy/privacy-policy';

export const routes: Routes = [
	{
		path: '',
		component: Hello,
		canActivate: [authGuard],
	},
	{
		path: 'profile',
		component: Profile,
		canActivate: [authGuard],
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
];
