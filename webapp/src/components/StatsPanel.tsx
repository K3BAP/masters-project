import type { DrawingResult } from '../algorithm/types';
import { useI18n } from '../i18n';

export function StatsPanel({ result }: { result: DrawingResult }) {
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
          <tr><td>{t('stats_maxdeg')}</td><td>{s.deltaOrig} / {s.deltaEff}</td></tr>
          <tr>
            <td>{t('stats_slopes')}</td>
            <td>
              {t('stats_slopes_value', {
                used: s.slopesUsed,
                plus: s.augmented || s.bumped ? '+1' : '',
                bound: s.slopesAllowedStrict,
              })}
            </td>
          </tr>
          <tr><td>{t('stats_grid')}</td><td>{s.width} × {s.height}</td></tr>
          <tr><td>{t('stats_rowspacing')}</td><td>{s.rowSpacing}</td></tr>
          <tr>
            <td>{t('stats_augmentation')}</td>
            <td>
              {s.augmented ? t('stats_aug_yes') : t('stats_aug_no')}
              {s.bumped ? t('stats_bump') : ''}
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
