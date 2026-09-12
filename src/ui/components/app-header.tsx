import { SubIcon, UsersIcon } from './icons';

/** Top bar: identity, which table this is, and how many divers are aboard. */
export function AppHeader({
  subtitle,
  code,
  divers,
}: {
  subtitle: string;
  code: string;
  divers: number;
}) {
  return (
    <header className="app-header">
      <div className="logo-group">
        <span className="logo-mark">
          <SubIcon size={20} />
        </span>
        <span className="logo-title">
          <strong>DEEP SEA ADVENTURE</strong>
          <small>{subtitle}</small>
        </span>
      </div>

      <div className="lobby-stats">
        <div className="stat-item">
          <span className="stat-label">TABLE:</span>
          <span className="code-badge">{code}</span>
        </div>
        <div className="stat-item stat-muted">
          <UsersIcon size={16} />
          <span>{divers} diving</span>
        </div>
      </div>
    </header>
  );
}
