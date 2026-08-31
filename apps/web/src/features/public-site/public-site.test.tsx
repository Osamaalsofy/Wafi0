import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicSiteShell } from './public-site-shell';
import { HomePublicPage, StandardPublicPage } from './public-pages';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('public WAFI website', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('renders public navigation and connects Login to the existing flow', () => {
    render(<PublicSiteShell><HomePublicPage /></PublicSiteShell>);
    expect(screen.getByRole('heading', { level: 1, name: /Smart Operations. Connected Transportation./i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Login/i })[0]).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/Request Demo|Book Demo|Schedule Demo/i)).not.toBeInTheDocument();
  });

  it('supports mobile navigation semantics', () => {
    render(<PublicSiteShell><HomePublicPage /></PublicSiteShell>);
    const menu = screen.getByRole('button', { name: /Menu/i });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
  });

  it('switches to professional Arabic RTL content', async () => {
    render(<PublicSiteShell><HomePublicPage /></PublicSiteShell>);
    fireEvent.click(screen.getByRole('button', { name: 'التبديل إلى العربية' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'تشغيل ذكي. نقل متكامل.' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('uses a cinematic inline video and an independent Saudi network layer', () => {
    const { container } = render(<PublicSiteShell><HomePublicPage /></PublicSiteShell>);
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('loop');
    expect(video?.querySelector('source')).toHaveAttribute('src', '/media/wafi-hero-truck.mp4');
    expect(screen.getAllByRole('figure', { name: /intelligent transportation network across Saudi Arabia/i })).toHaveLength(2);
    expect(container.querySelector('[data-city="riyadh"]')).toBeInTheDocument();
  });

  it('renders the connected homepage visual story without replacing real product facts', () => {
    const { container } = render(<PublicSiteShell><HomePublicPage /></PublicSiteShell>);
    expect(screen.getByRole('heading', { name: /One operating picture/i })).toBeInTheDocument();
    expect(screen.getByText('WAFI OS', { selector: '.os-core strong' })).toBeInTheDocument();
    expect(screen.getByText('Exception', { selector: '.is-exception strong' })).toBeInTheDocument();
    expect(screen.getByText('13', { selector: '.home-network-facts strong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enter WAFI OS/i })).toHaveAttribute('href', '/login');
    expect(container.querySelectorAll('.journey-route li[tabindex="0"]')).toHaveLength(7);
    expect(container.querySelectorAll('.os-domain[tabindex="0"]')).toHaveLength(6);
    expect(container.querySelectorAll('.intelligence-pipeline li[tabindex="0"]')).toHaveLength(5);
    expect(container.querySelectorAll('.hero-network.is-interactive .hero-city[tabindex="0"]')).toHaveLength(11);
  });

  it('labels ITS claims as future capabilities', () => {
    render(<PublicSiteShell><StandardPublicPage page="its" /></PublicSiteShell>);
    expect(screen.getAllByText(/Future Vision/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Future Capability/i)).toBeInTheDocument();
  });

  it('uses static public visuals without fetching protected data', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<PublicSiteShell><StandardPublicPage page="controlTower" /></PublicSiteShell>);
    expect(screen.getByText(/no live customer or GPS data/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
