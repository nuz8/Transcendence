export const AUTH_VALID_RULES = {
	USERNAME: {
		MIN: 3,
		MAX: 32,
	},
	PASSWORD: {
		MIN: 8,
		MAX: 72,
	},
	EMAIL: {
		MAX: 254,
	},
} as const;

export const AUTH_VALID_MSGS = {
	USERNAME_STRING: 'Username must be a string',
	USERNAME_REQUIRED: 'Username must not be empty',
	USERNAME_LENGTH: `Username must be between ${AUTH_VALID_RULES.USERNAME.MIN} and ${AUTH_VALID_RULES.USERNAME.MAX} characters long`,

	EMAIL_VALID: 'Email must be a valid email address',
	EMAIL_MAX_LENGTH: `Email cannot exceed ${AUTH_VALID_RULES.EMAIL.MAX} characters`,

	PASSWORD_STRING: 'Password must be a string',
	PASSWORD_REQUIRED: 'Password must not be empty',
	PASSWORD_LENGTH: `Password must be between ${AUTH_VALID_RULES.PASSWORD.MIN} and ${AUTH_VALID_RULES.PASSWORD.MAX} characters long`,

} as const;

export const REFRESH_TOKEN_COOKIE = {
	NAME: 'refresh_token',
	OPTIONS: {
		httpOnly: true,
		secure: true,
		sameSite: 'strict',
		path: '/api/auth',
	} as const,
} as const;
