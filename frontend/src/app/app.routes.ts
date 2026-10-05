import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { Hello } from './features/dummies/hello/hello';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
	{
		path: '',
		component: Hello,
		canActivate: [authGuard]
	},
	{
		path: 'login',
		component: Login,
		title: 'Login'
	},
	{
		path: 'register',
		component: Register,
		title: 'Register'
	}
];
