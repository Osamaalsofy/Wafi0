import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from './i18n-provider';
import { LocalizedSurface } from './localized-surface';

function NestedWorkspace({ loaded = false }: { loaded?: boolean }) {
  return <section aria-label="Mission status summary">{loaded ? <><h1>Control Tower</h1><span>IN TRANSIT</span><span>Stop arrival delay</span></> : <p>Loading…</p>}</section>;
}

describe('LocalizedSurface', () => {
  beforeEach(() => window.localStorage.setItem('wafi.locale', 'ar-SA'));

  it('localizes nested component output and content replaced after loading', async () => {
    const view = render(
      <I18nProvider>
        <LocalizedSurface>
          <NestedWorkspace />
        </LocalizedSurface>
      </I18nProvider>,
    );

    expect(await screen.findByText('جارٍ التحميل…')).toBeVisible();
    view.rerender(
      <I18nProvider>
        <LocalizedSurface>
          <NestedWorkspace loaded />
        </LocalizedSurface>
      </I18nProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'برج المراقبة' })).toBeVisible();
    expect(await screen.findByText('قيد النقل')).toBeVisible();
    expect(await screen.findByText('تأخير الوصول إلى المحطة')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'ملخص حالات المهام'),
    );
  });
});
