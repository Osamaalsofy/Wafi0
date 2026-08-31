'use client';
import { useEffect, useState } from 'react';
import { ApiRequestError, getDailyLoading, getOperationalReport } from '../../lib/api-client';
import Link from 'next/link';
import { useI18n } from '../../i18n/i18n-provider';
import { exportCsv, exportPdf, exportXlsx, type ExportColumn } from '../../lib/report-export';
interface ReportMission {
  id: string;
  missionNo: string;
  status: string;
  scheduledLoadingAt: string | null;
  client: { name: string };
  warehouse: { name: string };
  carrier: { name: string } | null;
  openExceptions: unknown[];
  stopProgress: { completed: number; total: number };
}
interface DailyReport {
  summary: { total: number; openLoadingDelays: number; incompleteDataConditions: number };
  data: ReportMission[];
  meta: { page: number; totalPages: number };
}
const reportTypes = [
  'daily-operations',
  'mission-performance',
  'client-sla',
  'driver-performance',
  'carrier-performance',
  'kpi',
  'exceptions',
  'delays',
  'route-deviation',
  'pod-compliance',
  'contract-performance',
  'audit',
] as const;
type ReportType = (typeof reportTypes)[number];
interface GenericReport {
  type: string;
  summary: { rows: number };
  rows: Array<Record<string, string | number | boolean | null>>;
}
const reportNames: Record<ReportType, { en: string; ar: string }> = {
  'daily-operations': { en: 'Daily Operations', ar: 'العمليات اليومية' },
  'mission-performance': { en: 'Mission Performance', ar: 'أداء المهام' },
  'client-sla': { en: 'Client SLA', ar: 'اتفاقيات مستوى خدمة العملاء' },
  'driver-performance': { en: 'Driver Performance', ar: 'أداء السائقين' },
  'carrier-performance': { en: 'Carrier Performance', ar: 'أداء شركات النقل' },
  kpi: { en: 'KPI', ar: 'مؤشرات الأداء' },
  exceptions: { en: 'Exceptions', ar: 'الاستثناءات' },
  delays: { en: 'Delays', ar: 'التأخيرات' },
  'route-deviation': { en: 'Route Deviation', ar: 'انحراف المسار' },
  'pod-compliance': { en: 'POD / Document Compliance', ar: 'الامتثال لإثبات التسليم والمستندات' },
  'contract-performance': { en: 'Contract Performance', ar: 'أداء العقود' },
  audit: { en: 'Audit', ar: 'سجل التدقيق' },
};
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function ReportsWorkspace({ accessToken }: { accessToken: string }) {
  const { locale, t } = useI18n();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [from, setFrom] = useState(localInput(start));
  const [to, setTo] = useState(localInput(end));
  const [applied, setApplied] = useState({ from, to });
  const [page, setPage] = useState(1);
  const [reportType, setReportType] = useState<ReportType>('daily-operations');
  const [report, setReport] = useState<DailyReport>();
  const [genericReport, setGenericReport] = useState<GenericReport>();
  const [error, setError] = useState<string>();
  const columns: ExportColumn<ReportMission>[] = [
    { header: t('reports.mission'), value: (item) => item.missionNo },
    { header: t('reports.status'), value: (item) => item.status },
    { header: t('reports.client'), value: (item) => item.client.name },
    { header: t('reports.warehouse'), value: (item) => item.warehouse.name },
    { header: t('reports.carrier'), value: (item) => item.carrier?.name ?? '' },
    {
      header: t('reports.stops'),
      value: (item) => `${item.stopProgress.completed}/${item.stopProgress.total}`,
    },
    { header: t('reports.exceptions'), value: (item) => item.openExceptions.length },
  ];
  function downloadReport(format: 'csv' | 'xlsx' | 'pdf') {
    const base = `wafi-${reportType}-${applied.from.slice(0, 10)}`;
    if (reportType === 'daily-operations') {
      if (!report) return;
      if (format === 'csv') exportCsv(`${base}.csv`, report.data, columns);
      if (format === 'xlsx')
        exportXlsx(
          `${base}.xlsx`,
          reportNames[reportType][locale === 'ar-SA' ? 'ar' : 'en'],
          report.data,
          columns,
        );
      if (format === 'pdf')
        exportPdf(
          `${base}.pdf`,
          reportNames[reportType][locale === 'ar-SA' ? 'ar' : 'en'],
          report.data,
          columns,
        );
      return;
    }
    if (!genericReport) return;
    const keys = [...new Set(genericReport.rows.flatMap((row) => Object.keys(row)))].filter(
      (key) => key !== 'id',
    );
    const genericColumns: ExportColumn<Record<string, string | number | boolean | null>>[] =
      keys.map((key) => ({ header: key, value: (row) => row[key] }));
    if (format === 'csv') exportCsv(`${base}.csv`, genericReport.rows, genericColumns);
    if (format === 'xlsx')
      exportXlsx(
        `${base}.xlsx`,
        reportNames[reportType][locale === 'ar-SA' ? 'ar' : 'en'],
        genericReport.rows,
        genericColumns,
      );
    if (format === 'pdf')
      exportPdf(
        `${base}.pdf`,
        reportNames[reportType][locale === 'ar-SA' ? 'ar' : 'en'],
        genericReport.rows,
        genericColumns,
      );
  }
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      from: new Date(applied.from).toISOString(),
      to: new Date(applied.to).toISOString(),
    });
    if (reportType === 'daily-operations') {
      query.set('page', String(page));
      query.set('limit', '25');
    }
    const request =
      reportType === 'daily-operations'
        ? getDailyLoading<DailyReport>(accessToken, query, controller.signal)
        : getOperationalReport<GenericReport>(accessToken, reportType, query, controller.signal);
    void request
      .then((response: DailyReport | GenericReport) => {
        if (reportType === 'daily-operations') {
          setReport(response as DailyReport);
          setGenericReport(undefined);
        } else {
          setGenericReport(response as GenericReport);
          setReport(undefined);
        }
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError ? requestError.message : t('reports.loadError'),
          );
      });
    return () => controller.abort();
  }, [accessToken, applied, page, reportType, t]);
  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t('reports.eyebrow')}</p>
          <h1>{t('reports.title')}</h1>
          <p className="muted">{t('reports.subtitle')}</p>
        </div>
      </header>
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>{reportNames[reportType][locale === 'ar-SA' ? 'ar' : 'en']}</h2>
            <p>
              {reportType === 'daily-operations'
                ? report
                  ? `${report.summary.total} ${t('reports.scheduled')}`
                  : t('reports.loading')
                : genericReport
                  ? `${genericReport.summary.rows}`
                  : t('reports.loading')}
            </p>
          </div>
          <form
            className="filters"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setApplied({ from, to });
            }}
          >
            <label>
              {locale === 'ar-SA' ? 'نوع التقرير' : 'Report type'}
              <select
                value={reportType}
                onChange={(event) => {
                  setReportType(event.target.value as ReportType);
                  setPage(1);
                }}
              >
                {reportTypes.map((type) => (
                  <option key={type} value={type}>
                    {reportNames[type][locale === 'ar-SA' ? 'ar' : 'en']}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('reports.from')}
              <input
                type="datetime-local"
                required
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              {t('reports.to')}
              <input
                type="datetime-local"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <button className="filter-button">{t('reports.run')}</button>
            <button
              className="quiet-button"
              type="button"
              disabled={!report && !genericReport}
              onClick={() => downloadReport('csv')}
            >
              CSV
            </button>
            <button
              className="quiet-button"
              type="button"
              disabled={!report && !genericReport}
              onClick={() => downloadReport('xlsx')}
            >
              XLSX
            </button>
            <button
              className="quiet-button"
              type="button"
              disabled={!report && !genericReport}
              onClick={() => downloadReport('pdf')}
            >
              PDF
            </button>
          </form>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        {reportType !== 'daily-operations' && genericReport ? (
          <div className="mission-table-wrap">
            {genericReport.rows.length ? (
              <table className="mission-table">
                <thead>
                  <tr>
                    {Object.keys(genericReport.rows[0] ?? {})
                      .filter((key) => key !== 'id')
                      .map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {genericReport.rows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      {Object.entries(row)
                        .filter(([key]) => key !== 'id')
                        .map(([key, value]) => (
                          <td key={key}>
                            {key === 'mission' && row.missionId ? (
                              <Link href={`/missions?missionId=${row.missionId}`}>
                                {String(value ?? '')}
                              </Link>
                            ) : (
                              String(value ?? '')
                            )}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="state-panel">
                {locale === 'ar-SA'
                  ? 'لا توجد بيانات ضمن الفترة المحددة'
                  : 'No data in the selected period'}
              </div>
            )}
          </div>
        ) : report ? (
          <>
            <div className="metric-grid">
              <article className="metric-card neutral">
                <span>{t('reports.scheduled')}</span>
                <strong>{report.summary.total}</strong>
              </article>
              <article className="metric-card amber">
                <span>{t('reports.delays')}</span>
                <strong>{report.summary.openLoadingDelays}</strong>
              </article>
              <article className="metric-card red">
                <span>{t('reports.incomplete')}</span>
                <strong>{report.summary.incompleteDataConditions}</strong>
              </article>
            </div>
            <div className="mission-table-wrap">
              <table className="mission-table">
                <thead>
                  <tr>
                    <th>{t('reports.mission')}</th>
                    <th>{t('reports.status')}</th>
                    <th>{t('reports.client')}</th>
                    <th>{t('reports.warehouse')}</th>
                    <th>{t('reports.carrier')}</th>
                    <th>{t('reports.stops')}</th>
                    <th>{t('reports.exceptions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.missionNo}</strong>
                        <small>
                          {item.scheduledLoadingAt
                            ? new Date(item.scheduledLoadingAt).toLocaleString(locale, {
                                timeZone: 'Asia/Riyadh',
                              })
                            : t('reports.notScheduled')}
                        </small>
                      </td>
                      <td>{item.status}</td>
                      <td>{item.client.name}</td>
                      <td>{item.warehouse.name}</td>
                      <td>{item.carrier?.name ?? t('reports.unassigned')}</td>
                      <td>
                        {item.stopProgress.completed}/{item.stopProgress.total}
                      </td>
                      <td>{item.openExceptions.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.meta.totalPages > 1 ? (
              <div className="pagination">
                <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                  {t('reports.previous')}
                </button>
                <span>
                  {page}/{report.meta.totalPages}
                </span>
                <button
                  disabled={page === report.meta.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t('reports.next')}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="state-panel" role="status">
            {t('reports.loadingDaily')}
          </div>
        )}
      </section>
    </main>
  );
}
