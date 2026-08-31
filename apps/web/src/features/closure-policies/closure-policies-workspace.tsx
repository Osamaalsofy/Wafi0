'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  archiveResource,
  getCollection,
  listResource,
  putResource,
} from '../../lib/api-client';
import { useSession } from '../auth/session-provider';

const documentTypes = [
  'WAYBILL',
  'GATE_PASS',
  'POD',
  'RECEIVER_SIGNATURE',
  'RECEIVER_STAMP',
  'SHORTAGE_PROOF',
  'RETURN_PROOF',
  'OTHER',
];
type Requirement = { documentType: string; scope: 'MISSION' | 'EACH_STOP' };
type Policy = {
  id: string;
  stage: string;
  isActive: boolean;
  client: { id: string; code: string; name: string };
  requirements: Requirement[];
  activatedBy: { name: string } | null;
  activatedAt: string | null;
};
type Client = { id: string; code: string; name: string; status: string };

export function ClosurePoliciesWorkspace({ accessToken }: { accessToken: string }) {
  const { hasPermission } = useSession();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [stage, setStage] = useState('OPERATIONAL_CLOSURE');
  const [requirements, setRequirements] = useState<Requirement[]>([
    { documentType: 'POD', scope: 'EACH_STOP' },
  ]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getCollection<Policy>(accessToken, '/closure-policies', controller.signal),
      listResource<Client>(
        accessToken,
        '/clients',
        new URLSearchParams({ page: '1', limit: '100', status: 'ACTIVE' }),
        controller.signal,
      ),
    ])
      .then(([nextPolicies, clientPage]) => {
        setPolicies(nextPolicies);
        setClients(clientPage.data);
        setError(undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : 'Unable to load closure policies',
          );
      });
    return () => controller.abort();
  }, [accessToken, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await putResource(accessToken, '/closure-policies', { clientId, stage, requirements });
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to save closure policy',
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(policy: Policy) {
    setBusy(true);
    setError(undefined);
    try {
      await archiveResource(
        accessToken,
        `/closure-policies/${policy.id}/${policy.isActive ? 'deactivate' : 'activate'}`,
      );
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to update closure policy',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dashboard closure-policies-dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">COMPLIANCE</p>
          <h1>Closure policies</h1>
          <p className="muted">
            Client document gates for operational closure and accounting readiness
          </p>
        </div>
      </header>
      {hasPermission('closure_policy.manage') ? (
        <section className="operations-panel compact-panel">
          <div className="panel-heading">
            <div>
              <h2>Configure policy</h2>
              <p>Active policies must be deactivated before replacement</p>
            </div>
          </div>
          <form className="master-form closure-policy-form" onSubmit={save}>
            <label>
              Client
              <select
                required
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Closure stage
              <select value={stage} onChange={(event) => setStage(event.target.value)}>
                <option value="OPERATIONAL_CLOSURE">Operational closure</option>
                <option value="ACCOUNTING_READINESS">Accounting readiness</option>
              </select>
            </label>
            <fieldset>
              <legend>Required documents</legend>
              {requirements.map((requirement, index) => (
                <div
                  className="inline-actions closure-requirement-row"
                  key={`${index}-${requirement.documentType}`}
                >
                  <select
                    value={requirement.documentType}
                    onChange={(event) =>
                      setRequirements(
                        requirements.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, documentType: event.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    {documentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <select
                    value={requirement.scope}
                    onChange={(event) =>
                      setRequirements(
                        requirements.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, scope: event.target.value as Requirement['scope'] }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="MISSION">Mission</option>
                    <option value="EACH_STOP">Each stop</option>
                  </select>
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setRequirements(requirements.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </fieldset>
            <div className="inline-actions closure-form-actions">
              <button
                type="button"
                onClick={() =>
                  setRequirements([...requirements, { documentType: 'POD', scope: 'EACH_STOP' }])
                }
              >
                Add requirement
              </button>
              <button className="primary-button" disabled={busy || !clientId}>
                Save policy
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="operations-panel">
        <div className="panel-heading">
          <div>
            <h2>Policy registry</h2>
            <p>{policies.length} policies</p>
          </div>
        </div>
        {error ? (
          <div className="state-panel error-state" role="alert">
            {error}
          </div>
        ) : null}
        <div className="mission-table-wrap">
          <table className="mission-table closure-policy-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Stage</th>
                <th>Requirements</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td data-label="العميل">
                    {policy.client.name}
                    <small>{policy.client.code}</small>
                  </td>
                  <td data-label="المرحلة">{policy.stage.replaceAll('_', ' ')}</td>
                  <td data-label="المتطلبات">
                    {policy.requirements
                      .map(
                        (item) =>
                          `${item.documentType.replaceAll('_', ' ')} (${item.scope.replaceAll('_', ' ')})`,
                      )
                      .join(', ') || 'No document gate'}
                  </td>
                  <td data-label="الحالة">{policy.isActive ? 'ACTIVE' : 'DRAFT'}</td>
                  <td data-label="الإجراءات">
                    {hasPermission('closure_policy.manage') ? (
                      <button
                        className={`mission-view-button ${policy.isActive ? 'danger' : ''}`}
                        disabled={busy}
                        onClick={() => void toggle(policy)}
                      >
                        {policy.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!policies.length && !error ? (
          <div className="state-panel">No closure policies configured.</div>
        ) : null}
      </section>
    </main>
  );
}
