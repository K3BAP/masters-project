import type { OneBendResult } from '../algorithm/onebend/types';
import { useI18n } from '../i18n';

export function OneBendStatsPanel({ result }: { result: OneBendResult }) {
  const { t } = useI18n();
  const s = result.stats;
  return (
    <div className="stats">
      <div className={result.verified ? 'badge pass' : 'badge fail'}>
        {result.verified ? t('stats_pass') : t('stats_fail')}
      </div>
      <table>
        <tbody>
          <tr>
            <td>{t('stats_nodes_edges')}</td>
            <td>{s.n} / {s.m}{s.augmented ? t('stats_incl_aug') : ''}</td>
          </tr>
          <tr>
            <td>{t('ob_stats_maxdeg')}</td>
            <td>{s.deltaOrig} / {s.deltaAug} / {s.deltaEff}</td>
          </tr>
          <tr><td>{t('ob_stats_k')}</td><td>{s.k.toLocaleString('de-DE')}</td></tr>
          <tr>
            <td>{t('stats_slopes')}</td>
            <td>
              {t('ob_stats_slopes_value', {
                used: s.slopesUsed,
                allowed: s.slopesAllowed,
                strict: s.slopesAllowedStrict,
              })}
            </td>
          </tr>
          <tr>
            <td>{t('stats_grid')}</td>
            <td>{s.width.toLocaleString('de-DE')} × {s.height.toLocaleString('de-DE')}</td>
          </tr>
          <tr><td>{t('ob_stats_parts')}</td><td>{s.parts}</td></tr>
          <tr>
            <td>{t('stats_augmentation')}</td>
            <td>
              {s.augmented ? t('ob_stats_aug_yes') : t('stats_aug_no')}
              {s.specialVn ? t('ob_stats_special') : ''}
            </td>
          </tr>
        </tbody>
      </table>
      <details>
        <summary>{t('stats_report')}</summary>
        <pre>{result.report}</pre>
      </details>
    </div>
  );
}
