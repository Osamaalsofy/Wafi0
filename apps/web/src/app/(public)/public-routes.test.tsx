import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicSiteShell } from '../../features/public-site/public-site-shell';
import HomePage from './page';
import PlatformPage from './platform/page';
import SolutionsPage from './solutions/page';
import ControlTowerPage from './control-tower/page';
import IntelligencePage from './intelligence/page';
import ItsPage from './its/page';
import CompanyPage from './company/page';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const routes = [
  ['/', HomePage], ['/platform', PlatformPage], ['/solutions', SolutionsPage],
  ['/control-tower', ControlTowerPage], ['/intelligence', IntelligencePage],
  ['/its', ItsPage], ['/company', CompanyPage],
] as const;

describe('public routes', () => {
  afterEach(cleanup);
  for (const [route, Page] of routes) {
    it(`renders ${route} without an authenticated session`, () => {
      render(<PublicSiteShell><Page /></PublicSiteShell>);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.queryByText(/Restoring secure session/i)).not.toBeInTheDocument();
    });
  }
});
