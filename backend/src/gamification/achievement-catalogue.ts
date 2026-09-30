export interface AchievementCatalogItem {
  id: string;
  title: string;
  description: string;
  badgeUrl: string;
  targetWins: number;
}

export const INITIAL_ACHIEVEMENTS: AchievementCatalogItem[] = [
  {
    id: 'WIN_1',
    title: 'First Blood',
    description: 'Win your first game',
    badgeUrl: '/static/badges/svg/win-1.svg',
    targetWins: 1, // 2^0
  },
  {
    id: 'WIN_2',
    title: 'Double Down',
    description: 'Win 2 games',
    badgeUrl: '/static/badges/svg/win-2.svg',
    targetWins: 2, // 2^1
  },
  {
    id: 'WIN_4',
    title: 'Four-Leaf Striker',
    description: 'Win 4 games',
    badgeUrl: '/static/badges/svg/win-4.svg',
    targetWins: 4, // 2^2
  },
  {
    id: 'WIN_8',
    title: 'Octa-Champion',
    description: 'Win 8 games',
    badgeUrl: '/static/badges/svg/win-8.svg',
    targetWins: 8, // 2^3
  },
  {
    id: 'WIN_16',
    title: 'Sweet Sixteen',
    description: 'Win 16 games',
    badgeUrl: '/static/badges/svg/win-16.svg',
    targetWins: 16, // 2^4
  },
  {
    id: 'WIN_32',
    title: 'Veteran Contender',
    description: 'Win 32 games',
    badgeUrl: '/static/badges/svg/win-32.svg',
    targetWins: 32, // 2^5
  },
  {
    id: 'WIN_64',
    title: 'Arena Dominator',
    description: 'Win 64 games',
    badgeUrl: '/static/badges/svg/win-64.svg',
    targetWins: 64, // 2^6
  },
  {
    id: 'WIN_128',
    title: 'Grandmaster',
    description: 'Win 128 games',
    badgeUrl: '/static/badges/svg/win-128.svg',
    targetWins: 128, // 2^7
  },
  {
    id: 'WIN_256',
    title: 'God',
    description: 'Win 256 games',
    badgeUrl: '/static/badges/svg/win-256.svg',
    targetWins: 256, // 2^8
  },
]